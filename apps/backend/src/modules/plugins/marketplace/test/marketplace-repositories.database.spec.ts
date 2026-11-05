import { requireIntegrationDatabase } from '@/test/test-database.guard';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = requireIntegrationDatabase();

describe('Marketplace repositories PostgreSQL', () => {
    let prisma: PrismaClient;

    const repositoryIds: string[] = [];

    beforeAll(async () => {
        prisma = new PrismaClient({
            adapter: new PrismaPg({
                connectionString: databaseUrl,
            }),
        });

        await prisma.$connect();
    });

    afterEach(async () => {
        if (repositoryIds.length === 0) {
            return;
        }

        await prisma.pluginRepository.deleteMany({
            where: {
                id: { in: repositoryIds },
            },
        });

        repositoryIds.length = 0;
    });

    afterAll(async () => {
        await prisma?.$disconnect();
    });

    it('creates and reads a community repository', async () => {
        const repository = await prisma.pluginRepository.create({
            data: {
                name: 'Marketplace Database Test',
                url: 'https://marketplace-db-test.example.org/registry.json',
                isOfficial: false,
                status: 'DISABLED',
            },
        });

        repositoryIds.push(repository.id);

        const stored = await prisma.pluginRepository.findUnique({
            where: { id: repository.id },
        });

        expect(stored).not.toBeNull();
        expect(stored?.name).toBe('Marketplace Database Test');
        expect(stored?.status).toBe('DISABLED');
        expect(stored?.isOfficial).toBe(false);
    });

    it('updates repository status', async () => {
        const repository = await prisma.pluginRepository.create({
            data: {
                name: 'Marketplace Status Test',
                url: 'https://marketplace-status-test.example.org/registry.json',
                isOfficial: false,
                status: 'DISABLED',
            },
        });

        repositoryIds.push(repository.id);

        const updated = await prisma.pluginRepository.update({
            where: { id: repository.id },
            data: { status: 'ENABLED' },
        });

        expect(updated.status).toBe('ENABLED');
    });

    it('enforces unique repository URLs', async () => {
        const url =
            'https://marketplace-unique-test.example.org/registry.json';

        const repository = await prisma.pluginRepository.create({
            data: {
                name: 'First Repository',
                url,
            },
        });

        repositoryIds.push(repository.id);

        await expect(
            prisma.pluginRepository.create({
                data: {
                    name: 'Duplicate Repository',
                    url,
                },
            }),
        ).rejects.toMatchObject({
            code: 'P2002',
        });
    });

    it('prevents updates to official repositories through the community filter', async () => {
        const repository = await prisma.pluginRepository.create({
            data: {
                name: 'Official Repository Test',
                url: 'https://marketplace-official-test.example.org/registry.json',
                isOfficial: true,
                status: 'ENABLED',
            },
        });

        repositoryIds.push(repository.id);

        const result = await prisma.pluginRepository.updateMany({
            where: {
                id: repository.id,
                isOfficial: false,
            },
            data: {
                status: 'DISABLED',
            },
        });

        expect(result.count).toBe(0);

        const stored = await prisma.pluginRepository.findUniqueOrThrow({
            where: { id: repository.id },
        });

        expect(stored.status).toBe('ENABLED');
    });
});
