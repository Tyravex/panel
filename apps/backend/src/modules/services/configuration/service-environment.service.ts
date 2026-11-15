import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { validateEggManifest } from '@/modules/eggs/egg-manifest.validator';
import type { EggManifest } from '@shared/types';
import { decryptServiceEnvironment, encryptServiceEnvironment } from './service-environment.crypto';

@Injectable()
export class ServiceEnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  async metadata(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { egg: true, eggConfiguration: true } });
    if (!service) throw new NotFoundException('Service not found');
    const values = decryptServiceEnvironment(serviceId, service.eggConfiguration?.environmentEncrypted);
    const variables = (service.egg?.manifest as unknown as EggManifest | undefined)?.variables ?? [];
    const allowed = new Set(variables.map((entry) => entry.name));
    const configured = Object.keys(values).filter((name) => allowed.has(name) && values[name].length > 0);
    const required = variables.filter((entry) => entry.required).map((entry) => entry.name);
    return { configured, required, missing: required.filter((name) => !configured.includes(name)) };
  }

  async update(actorId: number, serviceId: string, changes: unknown) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length > 64) throw new BadRequestException('Expected declared environment values');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${serviceId} FOR UPDATE`;
      const service = await tx.service.findUnique({ where: { id: serviceId }, include: { egg: true, eggConfiguration: true } });
      if (!service) throw new NotFoundException('Service not found');
      if (!['DRAFT', 'FAILED'].includes(service.installStatus)) throw new ConflictException('Environment changes currently require a draft or failed service');
      if (await tx.job.findFirst({ where: { serviceId, type: 'INSTALL', status: { in: ['PENDING', 'DISPATCHING', 'QUEUED', 'RUNNING'] } }, select: { id: true } })) throw new ConflictException('Environment is locked by an active installation');
      if (!service.egg) throw new BadRequestException('Select an Egg first');
      validateEggManifest(service.egg.manifest);
      const manifest = service.egg.manifest as unknown as EggManifest;
      const allowed = new Set((manifest.variables ?? []).map((entry) => entry.name));
      const values = decryptServiceEnvironment(serviceId, service.eggConfiguration?.environmentEncrypted);
      for (const [name, value] of Object.entries(changes)) {
        if (!allowed.has(name) || !(value === null || typeof value === 'string') || (typeof value === 'string' && (Buffer.byteLength(value) > 8192 || value.includes('\0')))) throw new BadRequestException('Invalid or undeclared environment value');
        if (value === null) delete values[name]; else values[name] = value;
      }
      for (const name of Object.keys(values)) if (!allowed.has(name)) delete values[name];
      if (Buffer.byteLength(JSON.stringify(values)) > 65536) throw new BadRequestException('Environment exceeds the allowed size');
      const environmentEncrypted = encryptServiceEnvironment(serviceId, values);
      await tx.serviceEggConfiguration.upsert({ where: { serviceId }, create: { serviceId, environmentEncrypted }, update: { environmentEncrypted } });
      await tx.service.update({ where: { id: serviceId }, data: { updatedAt: new Date() } });
      await tx.adminAuditLog.create({ data: { actorId, action: 'SERVICE_ENVIRONMENT_UPDATED', targetType: 'SERVICE', targetId: serviceId, metadata: { keys: Object.keys(changes) } } });
      return { configured: Object.keys(values) };
    });
  }
}
