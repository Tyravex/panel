import { ConflictException } from '@nestjs/common';
import { JobType } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { ServiceJobsService } from '../service-jobs.service';

describe('ServiceJobsService installation notifications', () => {
    const userId = 1;
    const serviceId = 'test-service-id';

    const job = {
        id: 'test-job-id',
        userId,
        serviceId,
        type: JobType.INSTALL,
        status: 'PENDING',
        progress: 0,
    };

    const notification = {
        id: 123,
        userId,
        content: 'Installation requested',
        read: false,
        createdAt: new Date(),
    };

    const manifest = {
        format: 'tyravex-egg',
        formatVersion: 1,
        id: 'nodejs-discord-bot',
        name: 'Node.js Discord Bot',
        version: '1.0.0',
        category: 'discord_bot',
        runtime: {
            image: 'node:22-bookworm-slim',
            startup: 'node index.js',
        },
        resources: {
            memoryMb: 512,
            cpuPercent: 10,
            diskMb: 512,
        },
        variables: [],
    };

    let service: ServiceJobsService;

    let transactionMock: jest.Mock;
    let createNotification: jest.Mock;
    let sendToUser: jest.Mock;

    let tx: {
        $queryRaw: jest.Mock;
        service: {
            findUnique: jest.Mock;
        };
        egg: {
            findUnique: jest.Mock;
        };
        job: {
            findFirst: jest.Mock;
            create: jest.Mock;
        };
    };

    beforeEach(() => {
        tx = {
            $queryRaw: jest.fn()
                .mockResolvedValueOnce([{ id: serviceId }])
                .mockResolvedValueOnce([{ id: 'repository-id' }]),
            service: {
                findUnique: jest.fn().mockResolvedValue({
                    id: serviceId,
                    nodeId: 'node-id',
                    eggId: 'egg-id',
                    dockerImage: 'node:22-bookworm-slim',
                    memoryMb: 512,
                    cpuPercent: 10,
                    diskMb: 512,
                    installStatus: 'DRAFT',
                    category: {
                        key: 'discord_bot',
                    },
                }),
            },
            egg: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce({
                        repositoryId: 'repository-id',
                    })
                    .mockResolvedValueOnce({
                        id: 'egg-id',
                        key: 'nodejs-discord-bot',
                        version: '1.0.0',
                        isEnabled: true,
                        manifest,
                        repository: {
                            status: 'ENABLED',
                        },
                    }),
            },
            job: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue(job),
            },
        };

        transactionMock = jest.fn(async (callback) => callback(tx));

        createNotification = jest.fn().mockResolvedValue(notification);
        sendToUser = jest.fn().mockResolvedValue(undefined);

        service = new ServiceJobsService(
            {
                $transaction: transactionMock,
            } as unknown as PrismaService,
            {
                create: createNotification,
            } as unknown as NotificationsService,
            {
                sendToUser,
            } as unknown as NotificationsGateway,
        );
    });

    it('creates and sends a notification after the installation job is committed', async () => {
        const result = await service.create(
            userId,
            serviceId,
            JobType.INSTALL,
        );

        expect(result).toEqual(job);
        expect(tx.job.create).toHaveBeenCalledTimes(1);
        expect(createNotification).toHaveBeenCalledTimes(1);
        expect(createNotification).toHaveBeenCalledWith(
            userId,
            expect.stringContaining(serviceId),
        );
        expect(sendToUser).toHaveBeenCalledWith(
            userId,
            notification,
        );

        const jobCreationOrder =
            tx.job.create.mock.invocationCallOrder[0];
        const notificationOrder =
            createNotification.mock.invocationCallOrder[0];

        expect(jobCreationOrder).toBeLessThan(notificationOrder);
    });

    it('does not notify when an active installation job already exists', async () => {
        tx.job.findFirst.mockResolvedValue({
            id: 'existing-job-id',
        });

        await expect(
            service.create(userId, serviceId, JobType.INSTALL),
        ).rejects.toThrow(ConflictException);

        expect(tx.job.create).not.toHaveBeenCalled();
        expect(createNotification).not.toHaveBeenCalled();
        expect(sendToUser).not.toHaveBeenCalled();
    });

    it('returns the created job when saving the notification fails', async () => {
        createNotification.mockRejectedValue(
            new Error('Notification database unavailable'),
        );

        const result = await service.create(
            userId,
            serviceId,
            JobType.INSTALL,
        );

        expect(result).toEqual(job);
        expect(tx.job.create).toHaveBeenCalledTimes(1);
        expect(sendToUser).not.toHaveBeenCalled();
    });

    it('returns the created job when Socket.IO delivery fails', async () => {
        sendToUser.mockRejectedValue(
            new Error('Socket.IO unavailable'),
        );

        const result = await service.create(
            userId,
            serviceId,
            JobType.INSTALL,
        );

        expect(result).toEqual(job);
        expect(createNotification).toHaveBeenCalledTimes(1);
        expect(sendToUser).toHaveBeenCalledTimes(1);
    });
});
