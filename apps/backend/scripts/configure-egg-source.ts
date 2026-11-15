import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const target = 'https://raw.githubusercontent.com/Tyravex/tyravex-eggs/main/registry.json';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 3)::text`;
    const sources = await tx.eggRepository.findMany({ select: { id: true, name: true, url: true, isOfficial: true, status: true } });
    const exact = sources.find((entry) => entry.url === target);
    const candidates = sources.filter((entry) => entry.isOfficial && !entry.url.startsWith('tyravex-custom:'));
    if (!exact && candidates.length > 1) throw new Error('Multiple official sources require explicit selection');
    const current = exact ?? candidates[0];
    if (process.argv.includes('--apply')) {
      if (current) await tx.eggRepository.update({ where: { id: current.id }, data: { url: target } });
      else await tx.eggRepository.create({ data: { name: 'Tyravex Eggs', url: target, isOfficial: true, status: 'DISABLED' } });
      await tx.adminAuditLog.create({ data: { actorId: null, action: 'EGG_REPOSITORY_SOURCE_CONFIGURED', targetType: 'EGG_REPOSITORY', targetId: current?.id ?? target,
        metadata: { operation: 'operator-approved-source-configuration', previousUrl: current?.url ?? null, url: target } } });
    }
    return { mode: process.argv.includes('--apply') ? 'applied' : 'preview', previous: current ?? null, url: target, existingSources: sources.length };
  });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error('Source configuration failed; no partial transaction was committed. Check database availability and source selection.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
