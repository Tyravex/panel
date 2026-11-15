import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class EggRepositoryArchiveService {
  constructor(private readonly prisma: PrismaService) {}
  async archive(id: string, actorId: number | null) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "EggRepository" WHERE "id" = ${id} FOR UPDATE`;
      const source = await tx.eggRepository.findUnique({ where: { id } });
      if (!source) throw new NotFoundException('Repository not found');
      if (source.isOfficial) throw new ConflictException('The official repository cannot be archived');
      if (!source.archivedAt) {
        await tx.eggRepository.update({ where: { id }, data: { archivedAt: new Date(), status: 'DISABLED', syncClaimUntil: null } });
        await tx.adminAuditLog.create({ data: { actorId, action: 'EGG_REPOSITORY_ARCHIVED', targetType: 'EGG_REPOSITORY', targetId: id,
          metadata: { definitionsPreserved: true, serviceAssignmentsPreserved: true } } });
      }
      return { archived: true };
    });
  }
}
