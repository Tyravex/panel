import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';

import { getPluginStorageRoot } from './plugin-storage.config';

/**
 * Resolves a relative path inside the managed plugin storage.
 *
 * Rejects absolute paths, Windows-style paths and attempts
 * to escape the storage root.
 *
 * This function validates paths lexically.
 * Symlinks must be checked before accessing files.
 */
export const resolvePluginStoragePath = (
  relativePath: string,
): string => {
  if (
    !relativePath ||
    relativePath.includes('\0') ||
    isAbsolute(relativePath) ||
    relativePath.includes('\\') ||
    relativePath.split('/').includes('..') ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new Error('Invalid plugin storage path.');
  }

  const storageRoot = getPluginStorageRoot();
  const resolvedPath = resolve(storageRoot, relativePath);
  const pathFromRoot = relative(storageRoot, resolvedPath);

  if (
    !pathFromRoot ||
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error('Plugin path must stay inside storage root.');
  }

  return resolvedPath;
};
