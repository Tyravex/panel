import { isAbsolute, resolve } from 'node:path';

export const PLUGIN_STORAGE_ENV_KEY = 'TYRAVEX_PLUGIN_STORAGE_DIR';

const DEFAULT_PLUGIN_STORAGE_DIR = 'storage/plugins';

/**
 * Returns the absolute path to the plugin storage directory.
 *
 * The directory is configured by the server administrator.
 * Plugin manifests must never control the storage root.
 */
export const getPluginStorageRoot = (): string => {
  const configuredPath = process.env[PLUGIN_STORAGE_ENV_KEY]?.trim();

  const storagePath = configuredPath || DEFAULT_PLUGIN_STORAGE_DIR;

  return isAbsolute(storagePath)
    ? resolve(storagePath)
    : resolve(process.cwd(), storagePath);
};
