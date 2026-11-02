import {
    ConflictException,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { PluginLifecycleService } from '../plugin-lifecycle.service';

describe('PluginLifecycleService', () => {
    const plugin = {
        id: 'example.language',
        type: 'LANGUAGE',
        version: '1.0.0',
        status: 'DISABLED',
        sourceRepository: null,
        installedAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const prisma = {
        plugin: {
            findUnique: jest.fn(),
            findUniqueOrThrow: jest.fn(),
            updateMany: jest.fn(),
        },
        language: {
            updateMany: jest.fn(),
        },
        adminAuditLog: {
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    let service: PluginLifecycleService;

    beforeEach(() => {
        jest.resetAllMocks();

        prisma.plugin.findUnique.mockResolvedValue({
            ...plugin,
        });

        prisma.plugin.findUniqueOrThrow.mockResolvedValue({
            ...plugin,
            status: 'INSTALLED',
        });

        prisma.plugin.updateMany.mockResolvedValue({
            count: 1,
        });

        prisma.language.updateMany.mockResolvedValue({
            count: 1,
        });

        prisma.adminAuditLog.create.mockResolvedValue({});

        prisma.$transaction.mockImplementation(
            async (
                callback: (
                    tx: typeof prisma,
                ) => Promise<unknown>,
            ) => callback(prisma),
        );

        service = new PluginLifecycleService(
            prisma as unknown as PrismaService,
        );
    });

    it('enables a language plugin and its language', async () => {
        const result = await service.enable(
            'example.language',
            1,
        );

        expect(result.status).toBe('INSTALLED');

        expect(prisma.plugin.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'example.language',
                status: 'DISABLED',
            },
            data: {
                status: 'INSTALLED',
            },
        });

        expect(prisma.language.updateMany).toHaveBeenCalledWith({
            where: {
                pluginId: 'example.language',
                isBuiltIn: false,
            },
            data: {
                isEnabled: true,
            },
        });

        expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorId: 1,
                action: 'plugin.enabled',
                targetType: 'Plugin',
                targetId: 'example.language',
            }),
        });
    });

    it('disables a language plugin and its language', async () => {
        prisma.plugin.findUnique.mockResolvedValue({
            ...plugin,
            status: 'INSTALLED',
        });

        prisma.plugin.findUniqueOrThrow.mockResolvedValue({
            ...plugin,
            status: 'DISABLED',
        });

        const result = await service.disable(
            'example.language',
            1,
        );

        expect(result.status).toBe('DISABLED');

        expect(prisma.language.updateMany).toHaveBeenCalledWith({
            where: {
                pluginId: 'example.language',
                isBuiltIn: false,
            },
            data: {
                isEnabled: false,
            },
        });

        expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'plugin.disabled',
            }),
        });
    });

    it('rejects a missing plugin', async () => {
        prisma.plugin.findUnique.mockResolvedValue(null);

        await expect(
            service.enable('missing.plugin', 1),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(prisma.plugin.updateMany).not.toHaveBeenCalled();
        expect(prisma.language.updateMany).not.toHaveBeenCalled();
        expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid administrator identity', async () => {
        await expect(
            service.enable('example.language', 0),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects enabling an already enabled plugin', async () => {
        prisma.plugin.findUnique.mockResolvedValue({
            ...plugin,
            status: 'INSTALLED',
        });

        await expect(
            service.enable('example.language', 1),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(prisma.plugin.updateMany).not.toHaveBeenCalled();
        expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it('rejects a plugin in INSTALLING state', async () => {
        prisma.plugin.findUnique.mockResolvedValue({
            ...plugin,
            status: 'INSTALLING',
        });

        await expect(
            service.enable('example.language', 1),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(prisma.plugin.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a concurrent status change', async () => {
        prisma.plugin.updateMany.mockResolvedValue({
            count: 0,
        });

        await expect(
            service.enable('example.language', 1),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(prisma.language.updateMany).not.toHaveBeenCalled();
        expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it('rejects a missing language registration', async () => {
        prisma.language.updateMany.mockResolvedValue({
            count: 0,
        });

        await expect(
            service.enable('example.language', 1),
        ).rejects.toThrow(
            'Plugin language registration is missing or inconsistent.',
        );

        expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    });

    it('does not update languages for other plugin types', async () => {
        prisma.plugin.findUnique.mockResolvedValue({
            ...plugin,
            type: 'THEME',
        });

        await service.enable('example.language', 1);

        expect(prisma.language.updateMany).not.toHaveBeenCalled();

        expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('does not write an audit log if language update fails', async () => {
        prisma.language.updateMany.mockRejectedValue(
            new Error('Database failure'),
        );

        await expect(
            service.enable('example.language', 1),
        ).rejects.toThrow('Database failure');

        expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
    });
});