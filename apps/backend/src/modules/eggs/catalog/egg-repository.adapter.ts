import { BadRequestException } from '@nestjs/common';
import type { EggManifest, EggCatalogOptions } from '@shared/types';
import { fields, record, text, validateCatalogOptions, startupCommand } from './egg-catalog-options';
import { validateEggManifest } from '../egg-manifest.validator';

/** Validate the repository format without discarding installer or profile semantics. */
export function adaptRepositoryEgg(raw: unknown): EggManifest {
  if (record(raw) && raw.format === 'tyravex-egg') {
    validateEggManifest(raw); return raw as unknown as EggManifest;
  }
  fields(raw, ['schemaVersion', 'id', 'name', 'description', 'version', 'category', 'runtime', 'install', 'startup', 'defaultProfile', 'profiles', 'variables']);
  if (raw.schemaVersion !== 1 || !text(raw.id, 100) || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(raw.id) || !text(raw.name, 100) || typeof raw.description !== 'string' || raw.description.length > 500 || !text(raw.version, 50) || !/^\d+\.\d+\.\d+$/.test(raw.version)) throw new BadRequestException('Invalid repository Egg identity or schema version');
  fields(raw.runtime, ['type', 'image', 'workingDirectory', 'defaultVersion', 'versions']);
  if (raw.runtime.type !== 'docker' || !text(raw.runtime.image)) throw new BadRequestException('Unsupported Egg runtime');
  const catalog = {
    contractVersion: 2, workingDirectory: raw.runtime.workingDirectory,
    install: raw.install, startup: raw.startup, versions: raw.runtime.versions ?? [], profiles: raw.profiles ?? [],
    ...(raw.runtime.defaultVersion !== undefined ? { defaultVersion: raw.runtime.defaultVersion } : {}),
    ...(raw.defaultProfile !== undefined ? { defaultProfile: raw.defaultProfile } : {}),
  };
  validateCatalogOptions(catalog);
  let category: string;
  if (raw.category === 'games') category = 'server';
  else if (raw.category === 'applications') category = 'other';
  else if (raw.category === 'bots' && raw.id.startsWith('tyravex.discord.')) category = 'discord_bot';
  else if (raw.category === 'bots' && raw.id.startsWith('tyravex.telegram.')) category = 'telegram_bot';
  else throw new BadRequestException('Egg category requires an explicit panel mapping');
  if (!Array.isArray(raw.variables) || raw.variables.length > 32) throw new BadRequestException('Invalid repository Egg variables');
  const variables = raw.variables.map((variable) => {
    fields(variable, ['name', 'type', 'required']);
    if (!text(variable.name, 64) || !/^[A-Z][A-Z0-9_]*$/.test(variable.name) || !['string', 'secret'].includes(String(variable.type)) || typeof variable.required !== 'boolean') throw new BadRequestException('Invalid repository Egg variable');
    return { name: variable.name, required: variable.required, secret: variable.type === 'secret' };
  });
  const manifest: EggManifest = { format: 'tyravex-egg', formatVersion: 1, id: raw.id, name: raw.name, description: raw.description, version: raw.version,
    category, runtime: { image: raw.runtime.image, startup: startupCommand(catalog.startup) },
    // Repository v1 has no resource defaults; these are editable panel suggestions.
    resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 }, variables, catalog: catalog as EggCatalogOptions };
  validateEggManifest(manifest); return manifest;
}
