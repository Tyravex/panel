import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Global permissions for the initial RBAC system.
const permissionNames = [
  'server:create',
  'server:manage:any',
  'server:suspend',
  'server:unsuspend',
  'node:manage',
  'user:read',
  'user:manage',
  'role:read',
  'role:manage',
  'billing:read',
  'billing:manage',
] as const;

async function main() {
  // Create missing permissions without modifying existing ones.
  for (const name of permissionNames) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create the protected system-owner role.
  // Existing role permissions are not overwritten.
  const owner = await prisma.role.upsert({
    where: { name: 'Owner' },
    update: {
      permissions: {
        connect: permissionNames.map((name) => ({ name })),
      },
    },
    create: {
      name: 'Owner',
      permissions: {
        connect: permissionNames.map((name) => ({ name })),
      },
    },
  });

  // Create an empty role for regular users.
  await prisma.role.upsert({
    where: { name: 'User' },
    update: {},
    create: { name: 'User' },
  });

  console.log(`RBAC seed completed. Owner role ID: ${owner.id}`);
  console.log('No user accounts were assigned roles.');
}

main()
  .catch((error) => {
    console.error('RBAC seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });