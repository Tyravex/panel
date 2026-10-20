import { readPluginJson } from './plugin-json-reader';
import { resolvePluginStoragePath } from './plugin-storage-path';
import {
    validateLanguagePluginManifest,
    type LanguagePluginManifest,
} from './language-plugin-manifest';
import {
    validateLanguagePluginTranslations,
    type LanguagePluginTranslations,
} from './language-plugin-translations';

export interface LoadedLanguagePlugin {
    manifest: LanguagePluginManifest;
    translations: LanguagePluginTranslations;
}

/**
 * Loads and validates a language plugin from local storage.
 *
 * The storage path must come from a trusted database record,
 * not directly from an HTTP request.
 *
 * This function does not verify plugin provenance or signatures.
 */
export const loadLanguagePlugin = async (
    storagePath: string,
): Promise<LoadedLanguagePlugin> => {
    // Ensure the plugin directory is inside managed storage.
    resolvePluginStoragePath(storagePath);

    const manifestData = await readPluginJson(
        `${storagePath}/manifest.json`,
    );

    if (!validateLanguagePluginManifest(manifestData)) {
        throw new Error('Invalid language plugin manifest.');
    }

    const translationPath = manifestData.translations.path.slice(2);

    const translationsData = await readPluginJson(
        `${storagePath}/${translationPath}`,
    );

    if (!validateLanguagePluginTranslations(translationsData)) {
        throw new Error('Invalid language plugin translations.');
    }

    return {
        manifest: manifestData,
        translations: translationsData,
    };
};
