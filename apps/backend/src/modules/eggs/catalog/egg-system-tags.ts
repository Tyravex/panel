import type { EggManifest, EggTag } from '@shared/types';
import type { Prisma } from '@prisma/client';

export const SYSTEM_EGG_TAGS: EggTag[] = [
  { id: 'system:discord-bot', name: 'Discord Bot', color: 'violet', system: true, ownerId: null },
  { id: 'system:telegram-bot', name: 'Telegram Bot', color: 'cyan', system: true, ownerId: null },
  { id: 'system:minecraft', name: 'Minecraft', color: 'green', system: true, ownerId: null },
  { id: 'system:nodejs', name: 'Node.js', color: 'green', system: true, ownerId: null },
  { id: 'system:python', name: 'Python', color: 'blue', system: true, ownerId: null },
  { id: 'system:game-server', name: 'Game server', color: 'amber', system: true, ownerId: null },
  { id: 'system:application', name: 'Application', color: 'slate', system: true, ownerId: null },
];

export function systemTagFilter(id: string): Prisma.EggWhereInput | null {
  const category = (key: string): Prisma.EggWhereInput => ({ manifest: { path: ['category'], equals: key } });
  switch (id) {
    case 'system:discord-bot': return category('discord_bot');
    case 'system:telegram-bot': return category('telegram_bot');
    case 'system:game-server': return category('server');
    case 'system:application': return category('other');
    case 'system:minecraft': return { OR: [{ key: { contains: 'minecraft', mode: 'insensitive' } }, { name: { contains: 'minecraft', mode: 'insensitive' } }] };
    case 'system:nodejs': return { OR: [{ manifest: { path: ['catalog', 'install', 'mode'], equals: 'nodejs' } }, { manifest: { path: ['runtime', 'image'], string_starts_with: 'node:' } }] };
    case 'system:python': return { OR: [{ manifest: { path: ['catalog', 'install', 'mode'], equals: 'python' } }, { manifest: { path: ['runtime', 'image'], string_starts_with: 'python:' } }] };
    default: return null;
  }
}

export function inferSystemEggTags(key: string, name: string, manifest: EggManifest): EggTag[] {
  const ids = new Set<string>();
  const categoryTag = { discord_bot: 'discord-bot', telegram_bot: 'telegram-bot', server: 'game-server', other: 'application' }[manifest.category];
  if (categoryTag) ids.add(`system:${categoryTag}`);
  if (/minecraft/i.test(`${key} ${name}`)) ids.add('system:minecraft');
  if (manifest.catalog?.install.mode === 'nodejs' || manifest.runtime?.image?.startsWith('node:')) ids.add('system:nodejs');
  if (manifest.catalog?.install.mode === 'python' || manifest.runtime?.image?.startsWith('python:')) ids.add('system:python');
  return SYSTEM_EGG_TAGS.filter((tag) => ids.has(tag.id));
}

export function newerEggVersion(next: string, current: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(next) || !/^\d+\.\d+\.\d+$/.test(current)) return false;
  const a = next.split('.').map(BigInt); const b = current.split('.').map(BigInt);
  for (let index = 0; index < 3; index++) { if (a[index] > b[index]) return true; if (a[index] < b[index]) return false; }
  return false;
}
