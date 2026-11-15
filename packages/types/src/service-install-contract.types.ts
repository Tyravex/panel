import type { EggStartup } from './egg-catalog.types';

/** Non-secret configuration. Execution and environment delivery require separate capabilities. */
export interface ServiceInstallCatalog {
  workingDirectory: '/app';
  install: { mode: 'nodejs' | 'python'; packageManager: 'npm' | 'pip' };
  startup: EggStartup;
  profileId: string | null;
  runtimeVersion: string | null;
}

export const SERVICE_INSTALL_CAPABILITIES = {
  decodeV1: 'service.install.decode.v1',
  decodeV2: 'service.install.decode.v2',
  executeV1: 'service.install.v1',
  executeV2: 'service.install.v2',
  secureEnvironment: 'service.environment.secure.v1',
  diskQuota: 'service.disk-quota.v1',
} as const;
