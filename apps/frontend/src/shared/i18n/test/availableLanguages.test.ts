import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getLanguageOptions: vi.fn(),
    getPluginTranslations: vi.fn(),
    hasResourceBundle: vi.fn(),
    registerPluginTranslations: vi.fn(),
    unregisterPluginTranslations: vi.fn(),
}));

vi.mock('@/shared/i18n', () => ({
    default: { hasResourceBundle: mocks.hasResourceBundle },
}));
vi.mock('@/features/auth/api/getLanguageOptions', () => ({
    getLanguageOptions: mocks.getLanguageOptions,
}));
vi.mock('../getPluginTranslations', () => ({
    getPluginTranslations: mocks.getPluginTranslations,
}));
vi.mock('../pluginTranslations', () => ({
    isValidLanguageCode: (code: string) => /^[a-z]{2,8}$/.test(code),
    registerPluginTranslations: mocks.registerPluginTranslations,
    unregisterPluginTranslations: mocks.unregisterPluginTranslations,
}));

const enabled = [
    { code: 'de', name: 'Deutsch', enabled: true },
    { code: 'en', name: 'English', enabled: true },
    { code: 'pl', name: 'Polski', enabled: true },
];
const disabled = enabled.map((option) =>
    option.code === 'de' ? { ...option, enabled: false } : option,
);

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
};

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const resources = new Set(['en', 'pl']);
    mocks.hasResourceBundle.mockImplementation((code: string) => resources.has(code));
    mocks.registerPluginTranslations.mockImplementation((code: string) => resources.add(code));
    mocks.unregisterPluginTranslations.mockImplementation((code: string) => resources.delete(code));
    mocks.getPluginTranslations.mockResolvedValue({ common: { hello: 'Hallo' } });
});

describe('availableLanguages', () => {
    it('shows a disabled plugin but does not load its translations', async () => {
        mocks.getLanguageOptions.mockResolvedValue(disabled);
        const { getAvailableLanguageOptions, getAvailableLanguages } =
            await import('../availableLanguages');
        expect(await getAvailableLanguageOptions()).toContainEqual({
            code: 'de', name: 'Deutsch', enabled: false,
        });
        expect((await getAvailableLanguages()).map((x) => x.code)).toEqual(['en', 'pl']);
        expect(mocks.getPluginTranslations).not.toHaveBeenCalled();
    });

    it('loads an enabled plugin and resolves the preferred language', async () => {
        mocks.getLanguageOptions.mockResolvedValue(enabled);
        const { getAvailableLanguages, resolveActiveLanguage } =
            await import('../availableLanguages');
        const languages = await getAvailableLanguages();
        expect(resolveActiveLanguage('de', languages)).toBe('de');
        expect(mocks.registerPluginTranslations).toHaveBeenCalledTimes(1);
    });

    it('falls back to en without modifying the preferred code', async () => {
        mocks.getLanguageOptions.mockResolvedValue(disabled);
        const { getAvailableLanguages, resolveActiveLanguage } =
            await import('../availableLanguages');
        const preferred = 'de';
        expect(resolveActiveLanguage(preferred, await getAvailableLanguages())).toBe('en');
        expect(preferred).toBe('de');
    });

    it('does not register translations if the plugin is disabled mid-request', async () => {
        const pendingTranslations = deferred<Record<string, unknown>>();
        mocks.getLanguageOptions
            .mockResolvedValueOnce(enabled)
            .mockResolvedValueOnce(disabled);
        mocks.getPluginTranslations.mockReturnValue(pendingTranslations.promise);
        const { getAvailableLanguageOptions } = await import('../availableLanguages');
        const result = getAvailableLanguageOptions();
        await vi.waitFor(() => expect(mocks.getPluginTranslations).toHaveBeenCalled());
        pendingTranslations.resolve({ common: { hello: 'Hallo' } });
        expect(await result).toContainEqual({ code: 'de', name: 'Deutsch', enabled: false });
        expect(mocks.registerPluginTranslations).not.toHaveBeenCalled();
    });

    it('shares an in-flight refresh between both consumers', async () => {
        const pendingOptions = deferred<typeof enabled>();
        mocks.getLanguageOptions.mockReturnValueOnce(pendingOptions.promise)
            .mockResolvedValue(disabled);
        const { getAvailableLanguages, getAvailableLanguageOptions } =
            await import('../availableLanguages');
        const a = getAvailableLanguages();
        const b = getAvailableLanguageOptions();
        pendingOptions.resolve(disabled);
        await Promise.all([a, b]);
        expect(mocks.getLanguageOptions).toHaveBeenCalledTimes(2);
    });
});
