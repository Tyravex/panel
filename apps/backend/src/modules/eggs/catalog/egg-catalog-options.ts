import { BadRequestException } from '@nestjs/common';
import type { EggCatalogOptions, EggStartup, EggManifest, ServiceEggSelection, ServiceInstallCatalog } from '@shared/types';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function fields(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new BadRequestException('Unknown or invalid Egg configuration field');
}
export function text(value: unknown, max = 255): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !value.includes('\0');
}
export function startup(value: unknown): asserts value is EggStartup {
  fields(value, ['mode', 'entrypoint']);
  if (!['npm-start', 'node-file', 'python-file'].includes(String(value.mode))) throw new BadRequestException('Unsupported startup mode');
  if (value.mode === 'npm-start') {
    if (value.entrypoint !== undefined) throw new BadRequestException('npm-start does not accept an entrypoint');
  } else if (!text(value.entrypoint, 160) || !/^[a-zA-Z0-9_./-]+\.(?:[cm]?js|py)$/.test(value.entrypoint) || value.entrypoint.startsWith('/') || value.entrypoint.split('/').includes('..') ||
    (value.mode === 'python-file' ? !value.entrypoint.endsWith('.py') : !/\.[cm]?js$/.test(value.entrypoint))) {
    throw new BadRequestException('Invalid startup entrypoint');
  }
}

export function validateCatalogOptions(value: unknown): asserts value is EggCatalogOptions {
  fields(value, ['contractVersion', 'workingDirectory', 'install', 'startup', 'defaultVersion', 'versions', 'defaultProfile', 'profiles']);
  if (value.contractVersion !== 2 || value.workingDirectory !== '/app') throw new BadRequestException('Unsupported Egg runtime contract');
  fields(value.install, ['mode', 'packageManager']);
  if (!((value.install.mode === 'nodejs' && value.install.packageManager === 'npm') || (value.install.mode === 'python' && value.install.packageManager === 'pip'))) throw new BadRequestException('Unsupported dependency installer');
  startup(value.startup);
  if (!Array.isArray(value.versions) || value.versions.length > 12 || !Array.isArray(value.profiles) || value.profiles.length > 16) throw new BadRequestException('Invalid Egg profiles or runtime versions');
  const versions = new Set<string>();
  for (const entry of value.versions) {
    fields(entry, ['version', 'image']);
    if (!text(entry.version, 20) || !/^(?:[0-9]+|3\.(?:11|12|13))$/.test(entry.version) || !text(entry.image) || versions.has(entry.version)) throw new BadRequestException('Invalid or duplicate runtime version');
    versions.add(entry.version);
  }
  if (value.defaultVersion !== undefined && (typeof value.defaultVersion !== 'string' || !versions.has(value.defaultVersion))) throw new BadRequestException('Unknown default runtime version');
  const profiles = new Set<string>();
  for (const profile of value.profiles) {
    fields(profile, ['id', 'name', 'startup', 'runtimeVersion']);
    if (!text(profile.id, 64) || !/^[a-z][a-z0-9-]*$/.test(profile.id) || !text(profile.name, 100) || profiles.has(profile.id)) throw new BadRequestException('Invalid or duplicate Egg profile');
    profiles.add(profile.id); startup(profile.startup);
    if (profile.runtimeVersion !== undefined && (typeof profile.runtimeVersion !== 'string' || !versions.has(profile.runtimeVersion))) throw new BadRequestException('Unknown profile runtime version');
  }
  if (value.defaultProfile !== undefined && (typeof value.defaultProfile !== 'string' || !profiles.has(value.defaultProfile))) throw new BadRequestException('Unknown default Egg profile');
  for (const configuration of [value.startup, ...value.profiles.map((profile) => profile.startup)]) {
    if ((value.install.mode === 'nodejs') === (configuration.mode === 'python-file')) throw new BadRequestException('Startup and dependency installer do not match');
  }
}

export function startupCommand(value: EggStartup): string {
  return value.mode === 'npm-start' ? 'npm start' : `${value.mode === 'node-file' ? 'node' : 'python'} ${value.entrypoint}`;
}

export function resolveEggSelection(manifest: EggManifest, selection: ServiceEggSelection = {}) {
  const catalog = manifest.catalog;
  if (!catalog) {
    if (selection.profileId || selection.runtimeVersion) throw new BadRequestException('This Egg has no selectable profiles or runtime versions');
    return { image: manifest.runtime.image, startup: manifest.runtime.startup, profileId: null, runtimeVersion: null };
  }
  validateCatalogOptions(catalog);
  const profileId = selection.profileId || catalog.defaultProfile;
  const profile = profileId ? catalog.profiles.find((entry) => entry.id === profileId) : undefined;
  if (profileId && !profile) throw new BadRequestException('Unknown Egg profile');
  const runtimeVersion = selection.runtimeVersion || profile?.runtimeVersion || catalog.defaultVersion;
  const runtime = runtimeVersion ? catalog.versions.find((entry) => entry.version === runtimeVersion) : undefined;
  if (runtimeVersion && !runtime) throw new BadRequestException('Unknown Egg runtime version');
  return { image: runtime?.image ?? manifest.runtime.image, startup: startupCommand(profile?.startup ?? catalog.startup), profileId: profileId ?? null, runtimeVersion: runtimeVersion ?? null };
}

export function buildInstallCatalog(manifest: EggManifest, selection: ServiceEggSelection = {}): ServiceInstallCatalog | null {
  if (!manifest.catalog) return null;
  const resolved = resolveEggSelection(manifest, selection);
  const profile = manifest.catalog.profiles.find((entry) => entry.id === resolved.profileId);
  return { workingDirectory: manifest.catalog.workingDirectory, install: manifest.catalog.install,
    startup: profile?.startup ?? manifest.catalog.startup, profileId: resolved.profileId, runtimeVersion: resolved.runtimeVersion };
}
