import { NotFoundException } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { UserDTO } from '@shared/types';
import { JobsService } from './jobs.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('JobsService authorization', () => {
    const prisma = {
        server: {
            findFirst: jest.fn(),
        },
        job: {
            create: jest.fn(),
        },
    };

    const service = new JobsService(
        prisma as unknown as PrismaService,
    );

    const regularUser: UserDTO = {
        id: 10,
        username: 'test-user',
        email: 'user@example.test',
        roles: ['user'],
        permissions: [],
        createdAt: new Date(),
    };

    const serverManager: UserDTO = {
        id: 1,
        username: 'server-manager',
        email: 'manager@example.test',
        roles: ['server-manager'],
        permissions: ['server:manage:any'],
        createdAt: new Date(),
    };

    const adminWithoutPermission: UserDTO = {
        id: 3,
        username: 'limited-admin',
        email: 'limited@example.test',
        roles: ['admin'],
        permissions: [],
        createdAt: new Date(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it.each([
        JobType.INSTALL,
        JobType.REINSTALL,
        JobType.RESTART,
        JobType.BACKUP,
    ])('allows the server owner to request %s', async (type) => {
        prisma.server.findFirst.mockResolvedValue({ id: 2 });
        prisma.job.create.mockResolvedValue({ id: 'job-test' });

        await service.create(regularUser, {
            type,
            serverId: 2,
        });

        expect(prisma.server.findFirst).toHaveBeenCalledWith({
            where: {
                id: 2,
                userId: 10,
            },
            select: {
                id: true,
            },
        });

        expect(prisma.job.create).toHaveBeenCalledWith({
            data: {
                type,
                userId: 10,
                serverId: 2,
                status: 'PENDING',
                progress: 0,
            },
        });
    });

    it.each([
        JobType.INSTALL,
        JobType.REINSTALL,
        JobType.RESTART,
        JobType.BACKUP,
    ])('rejects %s when the server is not assigned to the user', async (type) => {
        prisma.server.findFirst.mockResolvedValue(null);

        await expect(
            service.create(regularUser, {
                type,
                serverId: 2,
            }),
        ).rejects.toThrow(NotFoundException);

        expect(prisma.server.findFirst).toHaveBeenCalledWith({
            where: {
                id: 2,
                userId: 10,
            },
            select: {
                id: true,
            },
        });

        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    it('allows users with server:manage:any to manage other servers', async () => {
        prisma.server.findFirst.mockResolvedValue({ id: 2 });
        prisma.job.create.mockResolvedValue({ id: 'manager-job' });

        await service.create(serverManager, {
            type: JobType.REINSTALL,
            serverId: 2,
        });

        expect(prisma.server.findFirst).toHaveBeenCalledWith({
            where: {
                id: 2,
            },
            select: {
                id: true,
            },
        });

        expect(prisma.job.create).toHaveBeenCalledWith({
            data: {
                type: JobType.REINSTALL,
                userId: 1,
                serverId: 2,
                status: 'PENDING',
                progress: 0,
            },
        });
    });

    it('does not grant global access based only on the admin role name', async () => {
        prisma.server.findFirst.mockResolvedValue(null);

        await expect(
            service.create(adminWithoutPermission, {
                type: JobType.RESTART,
                serverId: 2,
            }),
        ).rejects.toThrow(NotFoundException);

        expect(prisma.server.findFirst).toHaveBeenCalledWith({
            where: {
                id: 2,
                userId: 3,
            },
            select: {
                id: true,
            },
        });

        expect(prisma.job.create).not.toHaveBeenCalled();
    });
});