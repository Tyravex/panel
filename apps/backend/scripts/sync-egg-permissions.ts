import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { RBAC_V2_PERMISSION_GROUPS } from '../../../packages/types/src/rbac/rbac-permissions';

// This scoped repair never initializes roles, settings, users, or other permissions.
const names = [...RBAC_V2_PERMISSION_GROUPS.eggs];
const apply = process.argv.includes('--apply');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // Use the same lock order as the RBAC initializer.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 1)::text`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 2)::text`;
    const owner = await tx.role.findUnique({
      where: { name: 'Owner' },
      select: { id: true, permissions: { select: { name: true } } },
    });
    if (!owner) throw new Error('Owner role does not exist; no changes were made');
    const before = await tx.permission.findMany({ where: { name: { in: names } }, select: { name: true } });
    const missingCatalog = names.filter((name) => !before.some((permission) => permission.name === name));
    const missingOwner = names.filter((name) => !owner.permissions.some((permission) => permission.name === name));
    if (apply) {
      for (const name of names) {
        await tx.permission.upsert({ where: { name }, update: {}, create: { name } });
      }
      const updated = await tx.role.update({
        where: { id: owner.id },
        data: { permissions: { connect: names.map((name) => ({ name })) } },
        select: { permissions: { select: { name: true } } },
      });
      const expected = new Set([...owner.permissions.map((permission) => permission.name), ...names]);
      if (updated.permissions.length !== expected.size || updated.permissions.some((permission) => !expected.has(permission.name))) {
        throw new Error('Owner permission verification failed; transaction rolled back');
      }
    }
    return { mode: apply ? 'applied' : 'preview', permissions: names, missingCatalog, missingOwner };
  }, { maxWait: 10000, timeout: 20000 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(() => {
  // Connection strings and database diagnostics may contain credentials.
  console.error('Egg permission synchronization failed; no partial transaction was committed. Check database availability and the Owner role.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
