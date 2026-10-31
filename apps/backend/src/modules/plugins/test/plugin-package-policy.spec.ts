import {
    validatePluginPackageEntries,
    validatePluginPackagePath,
    type PluginPackageEntry,
} from '../plugin-package-policy';

const validEntries = (): PluginPackageEntry[] => [
    {
        path: 'manifest.json',
        size: 128,
        kind: 'file',
    },
    {
        path: 'translations/',
        size: 0,
        kind: 'directory',
    },
    {
        path: 'translations/en.json',
        size: 256,
        kind: 'file',
    },
];

describe('Plugin package policy', () => {
    it('accepts a valid package layout', () => {
        const result = validatePluginPackageEntries(
            validEntries(),
        );

        expect(result.totalExtractedBytes).toBe(384);
        expect(result.entries).toHaveLength(3);
    });

    it.each([
        '../secret.txt',
        '/etc/passwd',
        'C:/Windows/system.ini',
        'folder/../../secret.txt',
        'folder\\secret.txt',
        'folder//file.txt',
        './manifest.json',
        'folder/./file.txt',
        'folder/../file.txt',
        'folder/file.txt:stream',
    ])('rejects unsafe path %s', (path) => {
        expect(() =>
            validatePluginPackagePath(path),
        ).toThrow();
    });

    it('rejects duplicate paths', () => {
        expect(() =>
            validatePluginPackageEntries([
                ...validEntries(),
                {
                    path: 'MANIFEST.JSON',
                    size: 100,
                    kind: 'file',
                },
            ]),
        ).toThrow('Duplicate');
    });

    it('rejects symbolic links', () => {
        expect(() =>
            validatePluginPackageEntries([
                ...validEntries(),
                {
                    path: 'translations/link.json',
                    size: 0,
                    kind: 'symlink',
                },
            ]),
        ).toThrow('unsupported entry type');
    });

    it('requires a root manifest', () => {
        expect(() =>
            validatePluginPackageEntries([
                {
                    path: 'nested/manifest.json',
                    size: 128,
                    kind: 'file',
                },
            ]),
        ).toThrow('root manifest.json');
    });

    it('rejects oversized files', () => {
        expect(() =>
            validatePluginPackageEntries([
                {
                    path: 'manifest.json',
                    size: 6 * 1024 * 1024,
                    kind: 'file',
                },
            ]),
        ).toThrow('size limit');
    });

    it('rejects file and directory conflicts', () => {
        expect(() =>
            validatePluginPackageEntries([
                ...validEntries(),
                {
                    path: 'translations/en.json/extra',
                    size: 10,
                    kind: 'file',
                },
            ]),
        ).toThrow('conflicts with a file');
    });

    it('rejects empty packages', () => {
        expect(() =>
            validatePluginPackageEntries([]),
        ).toThrow('entry count');
    });

    it('rejects too many entries', () => {
        const entries: PluginPackageEntry[] = [
            {
                path: 'manifest.json',
                size: 10,
                kind: 'file',
            },
            ...Array.from({ length: 500 }, (_, index) => ({
                path: `files/${index}.txt`,
                size: 1,
                kind: 'file' as const,
            })),
        ];

        expect(() =>
            validatePluginPackageEntries(entries),
        ).toThrow('entry count');
    });
});
