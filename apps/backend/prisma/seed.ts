import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const permissionNames = [
  'server:create', 'server:manage:any', 'server:suspend', 'server:unsuspend',
  'service:create', 'service:manage:any',
  'node:manage', 'user:read', 'user:manage', 'role:read', 'role:manage',
  'billing:read', 'billing:manage',
] as const;

const builtInLanguages = [
  { code: 'en', name: 'English', isFallback: true },
  { code: 'pl', name: 'Polski', isFallback: false },
  { code: 'de', name: 'Deutsch', isFallback: false },
] as const;

const serviceCategories = [
  { key: 'server', name: 'Servers', description: 'Game servers, virtual servers, and other hosted servers.' },
  { key: 'discord_bot', name: 'Discord Bots', description: 'Bots and applications hosted for Discord.' },
  { key: 'telegram_bot', name: 'Telegram Bots', description: 'Bots and applications hosted for Telegram.' },
  { key: 'other', name: 'Other Services', description: 'Additional hosted services and applications.' },
] as const;

async function main() {
  for (const name of permissionNames) {
    await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
  }
  const owner = await prisma.role.upsert({
    where: { name: 'Owner' },
    update: { permissions: { connect: permissionNames.map((name) => ({ name })) } },
    create: { name: 'Owner', permissions: { connect: permissionNames.map((name) => ({ name })) } },
  });
  await prisma.role.upsert({ where: { name: 'User' }, update: {}, create: { name: 'User' } });
  for (const category of serviceCategories) {
    await prisma.serviceCategory.upsert({
      where: { key: category.key }, update: {},
      create: { key: category.key, name: category.name, description: category.description },
    });
  }
  for (const language of builtInLanguages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: { name: language.name, isBuiltIn: true, ...(language.isFallback ? { isEnabled: true, isFallback: true } : {}) },
      create: { code: language.code, name: language.name, isBuiltIn: true, isEnabled: true, isFallback: language.isFallback },
    });
  }
  console.log(`RBAC seed completed. Owner role ID: ${owner.id}`);
  console.log('No user accounts were assigned roles.');
  console.log(`Service catalog seed completed. ${serviceCategories.length} default categories checked.`);
  console.log('Existing service categories and services were preserved.');
  console.log(`Language seed completed. ${builtInLanguages.length} built-in languages checked.`);
  console.log('Existing administrator language activation choices were preserved.');
}
main().catch((error) => { console.error('Database seed failed:', error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
