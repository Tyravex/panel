import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { EggRepositoryArchiveService } from '../src/modules/eggs/catalog/egg-repository-archive.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const source = await prisma.eggRepository.findUnique({ where: { url: 'https://github.com/tyravex/eggs-test' },
    select: { id: true, name: true, archivedAt: true, isOfficial: true, _count: { select: { eggs: true } } } });
  if (!source) { console.log('The test source is absent. No changes made.'); return; }
  if (source.isOfficial) throw new Error('Refusing to archive an official source');
  if (process.argv.includes('--apply')) {
    await new EggRepositoryArchiveService(prisma as unknown as PrismaService).archive(source.id, null);
    console.log('The test source was archived. Egg definitions and service assignments were preserved.');
  } else console.log(JSON.stringify({ mode: 'preview', ...source }, null, 2));
}
main().catch(() => { console.error('Archive operation failed. Check migration availability and the exact test source. No definitions were deleted.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
