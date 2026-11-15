/** Repository v1 metadata retained alongside the panel's normalized manifest. */
export interface EggStartup {
  mode: 'npm-start' | 'node-file' | 'python-file';
  entrypoint?: string;
}

export interface EggCatalogOptions {
  contractVersion: 2;
  workingDirectory: '/app';
  install: { mode: 'nodejs' | 'python'; packageManager: 'npm' | 'pip' };
  startup: EggStartup;
  defaultVersion?: string;
  versions: { version: string; image: string }[];
  defaultProfile?: string;
  profiles: { id: string; name: string; startup: EggStartup; runtimeVersion?: string }[];
}

export interface EggProvenance {
  url: string;
  path: string;
  commit: string | null;
  sha256: string;
  importedAt: string;
}

export interface ServiceEggSelection {
  profileId?: string;
  runtimeVersion?: string;
}

export interface ServiceEnvironmentMetadata {
  configured: string[];
  required: string[];
  missing: string[];
}
