import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EGG_TAG_COLORS, type EggTag, type UserDTO } from '@shared/types';
import { SYSTEM_EGG_TAGS } from './egg-system-tags';
import { inferSystemEggTags } from './egg-system-tags';
import type { EggManifest } from '@shared/types';

type Actor = Pick<UserDTO, 'id' | 'permissions'>;
export const visibleEggTagWhere = (userId: number) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

@Injectable()
export class EggTagsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(actor: Actor) {
    const tags = await this.prisma.eggTag.findMany({ where: visibleEggTagWhere(actor.id), orderBy: { name: 'asc' } });
    return [...SYSTEM_EGG_TAGS, ...tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, ownerId: tag.ownerId, system: false }))];
  }
  async forEgg(actor: Actor, eggId: string) {
    const egg = await this.prisma.egg.findUnique({ where: { id: eggId }, include: { tagAssignments: { where: { tag: visibleEggTagWhere(actor.id) }, include: { tag: true } } } });
    if (!egg) throw new NotFoundException('Egg not found');
    if (!actor.permissions?.includes('egg:read') && !(egg.sourceType === 'CUSTOM' && egg.ownerId === actor.id)) throw new ForbiddenException('Egg is outside your scope');
    return [...inferSystemEggTags(egg.key, egg.name, egg.manifest as unknown as EggManifest), ...egg.tagAssignments.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color, ownerId: tag.ownerId, system: false }))];
  }

  private validate(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['name', 'color', 'shared'].includes(key))) throw new BadRequestException('Invalid tag fields');
    const { name, color, shared } = input as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 40 || /[\u0000-\u001f]/.test(name) || typeof color !== 'string' || !(EGG_TAG_COLORS as readonly string[]).includes(color) || (shared !== undefined && typeof shared !== 'boolean')) throw new BadRequestException('Invalid tag name, color or scope');
    return { name: name.trim(), color, shared: shared === true };
  }
  async create(actor: Actor, raw: unknown) {
    const input = this.validate(raw);
    if (input.shared && !actor.permissions?.includes('egg:manage')) throw new ForbiddenException('egg:manage is required for shared tags');
    const ownerId = input.shared ? null : actor.id;
    return this.prisma.$transaction(async (tx) => {
      const scopeKey = input.shared ? 'shared' : `user:${actor.id}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(847204, hashtext(${scopeKey}))::text`;
      if (await tx.eggTag.count({ where: { scopeKey } }) >= 100) throw new BadRequestException('Tag limit reached');
      const tag = await tx.eggTag.create({ data: { name: input.name, slug: input.name.toLocaleLowerCase('en'), color: input.color, scopeKey, ownerId } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'EGG_TAG_CREATED', targetType: 'EGG_TAG', targetId: tag.id, metadata: { shared: input.shared } } });
      return { id: tag.id, name: tag.name, color: tag.color, ownerId: tag.ownerId, system: false };
    }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ConflictException('A tag with this name already exists in this scope');
      throw error;
    });
  }

  async update(actor: Actor, id: string, raw: unknown) {
    if (id.startsWith('system:')) throw new ForbiddenException('System tags cannot be changed');
    const input = this.validate(raw);
    if (raw && typeof raw === 'object' && 'shared' in raw) throw new BadRequestException('Tag scope cannot be changed');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "EggTag" WHERE "id" = ${id} FOR UPDATE`;
      const tag = await tx.eggTag.findUnique({ where: { id } });
      if (!tag) throw new NotFoundException('Tag not found');
      if (tag.ownerId !== actor.id && !(tag.ownerId === null && actor.permissions?.includes('egg:manage'))) throw new ForbiddenException('Tag is outside your scope');
      const updated = await tx.eggTag.update({ where: { id }, data: { name: input.name, slug: input.name.toLocaleLowerCase('en'), color: input.color } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'EGG_TAG_UPDATED', targetType: 'EGG_TAG', targetId: id } });
      return { id: updated.id, name: updated.name, color: updated.color, ownerId: updated.ownerId, system: false };
    }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ConflictException('A tag with this name already exists in this scope');
      throw error;
    });
  }

  async remove(actor: Actor, id: string) {
    if (id.startsWith('system:')) throw new ForbiddenException('System tags cannot be changed');
    return this.prisma.$transaction(async (tx) => {
      const tag = await tx.eggTag.findUnique({ where: { id } });
      if (!tag) throw new NotFoundException('Tag not found');
      if (tag.ownerId !== actor.id && !(tag.ownerId === null && actor.permissions?.includes('egg:manage'))) throw new ForbiddenException('Tag is outside your scope');
      await tx.eggTag.delete({ where: { id } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'EGG_TAG_DELETED', targetType: 'EGG_TAG', targetId: id } });
      return { deleted: true };
    });
  }

  async assign(actor: Actor, eggId: string, ids: unknown) {
    if (!Array.isArray(ids) || ids.length > 20 || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new BadRequestException('Select at most 20 unique custom tags');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Egg" WHERE "id" = ${eggId} FOR UPDATE`;
      const egg = await tx.egg.findUnique({ where: { id: eggId }, select: { id: true, sourceType: true, ownerId: true } });
      if (!egg) throw new NotFoundException('Egg not found');
      if (!actor.permissions?.includes('egg:manage') && !(egg.sourceType === 'CUSTOM' && egg.ownerId === actor.id)) throw new ForbiddenException('You cannot tag this Egg');
      const tags = await tx.eggTag.findMany({ where: { id: { in: ids }, ...visibleEggTagWhere(actor.id) } });
      if (tags.length !== ids.length) throw new ForbiddenException('One or more tags are outside your scope');
      await tx.eggTagAssignment.deleteMany({ where: { eggId, tag: visibleEggTagWhere(actor.id) } });
      if (ids.length) await tx.eggTagAssignment.createMany({ data: ids.map((tagId: string) => ({ eggId, tagId })) });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'EGG_TAGS_UPDATED', targetType: 'EGG', targetId: eggId, metadata: { tagIds: ids } } });
      return { updated: true };
    });
  }
}
