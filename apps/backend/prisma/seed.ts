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

// Default service categories for the Tyravex service catalog.
const serviceCategories = [
  {
    key: 'server',
    name: 'Servers',
    description: 'Game servers, virtual servers, and other hosted servers.',
  },
  {
    key: 'discord_bot',
    name: 'Discord Bots',
    description: 'Bots and applications hosted for Discord.',
  },
  {
    key: 'telegram_bot',
    name: 'Telegram Bots',
    description: 'Bots and applications hosted for Telegram.',
  },
  {
    key: 'other',
    name: 'Other Services',
    description: 'Additional hosted services and applications.',
  },
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

  // Create missing service categories without overwriting existing settings.
  for (const category of serviceCategories) {
    await prisma.serviceCategory.upsert({
      where: { key: category.key },
      update: {},
      create: {
        key: category.key,
        name: category.name,
        description: category.description,
      },
    });
  }

  console.log(`RBAC seed completed. Owner role ID: ${owner.id}`);
  console.log('No user accounts were assigned roles.');
  console.log(
    `Service catalog seed completed. ${serviceCategories.length} default categories checked.`,
  );
  console.log('Existing service categories and services were preserved.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
