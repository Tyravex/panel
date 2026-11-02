import { readPluginJson } from '../storage/plugin-json-reader';
import { resolvePluginStoragePath } from '../storage/plugin-storage-path';
import {
    getLanguageTranslationPaths,
    validateLanguagePluginManifest,
    type LanguagePluginManifest,
} from './language-plugin-manifest';
import { mergeLanguageTranslationFiles } from './language-plugin-translation-merge';
import type { LanguagePluginTranslations } from './language-plugin-translations';

/**
 * Loads and validates a language plugin from local storage.
 *
 * The storage path must come from a trusted database record,
 * not directly from an HTTP request.
 *
 * This function does not verify plugin provenance or signatures.
 */
export interface LoadedLanguagePlugin {
    manifest: LanguagePluginManifest;
    translations: LanguagePluginTranslations;
}

export const loadLanguagePlugin = async (
    storagePath: string,
): Promise<LoadedLanguagePlugin> => {
    resolvePluginStoragePath(storagePath);
    const manifestData = await readPluginJson(`${storagePath}/manifest.json`);
    if (!validateLanguagePluginManifest(manifestData)) {
        throw new Error('Invalid language plugin manifest.');
    }
    const paths = getLanguageTranslationPaths(manifestData);
    const resources = await Promise.all(paths.map((path) =>
        readPluginJson(`${storagePath}/${path.slice(2)}`),
    ));
    return {
        manifest: manifestData,
        translations: mergeLanguageTranslationFiles(resources),
    };
};