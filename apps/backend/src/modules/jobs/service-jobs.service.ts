import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { JobType, Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { validateEggManifest } from '../eggs/egg-manifest.validator';

interface InstallManifest {
    category: string;
    runtime: {
        image: string;
        startup: string;
    };
    resources: {
        memoryMb: number;
        cpuPercent: number;
        diskMb: number;
    };
    variables?: Array<{
        name: string;
        required: boolean;
        secret: boolean;
    }>;
}

@Injectable()
export class ServiceJobsService {
    private readonly logger = new Logger(ServiceJobsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) {}

    private async notifyInstallQueued(
        userId: number,
        serviceId: string,
    ): Promise<void> {
        try {
            const notification = await this.notificationsService.create(
                userId,
                `Installation requested for service ${serviceId}. Waiting for execution.`,
            );

            try {
                await this.notificationsGateway.sendToUser(
                    userId,
                    notification,
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to deliver installation notification for service ${serviceId}: ${String(error)}`,
                );
            }
        } catch (error) {
            this.logger.warn(
                `Failed to save installation notification for service ${serviceId}: ${String(error)}`,
            );
        }
    }

    async getActive(userId: number, serviceId: string) {
        const service = await this.prisma.service.findFirst({
            where: {
                id: serviceId,
                userId,
            },
            select: {
                id: true,
            },
        });

        if (!service) {
            throw new NotFoundException('Service not found');
        }

        return this.prisma.job.findFirst({
            where: {
                serviceId,
                type: JobType.INSTALL,
                status: {
                    in: [
                        'PENDING',
                        'DISPATCHING',
                        'QUEUED',
                        'RUNNING',
                    ],
                },
            },
            select: {
                id: true,
                type: true,
                status: true,
                progress: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async create(userId: number, serviceId: string, type: JobType) {
        if (type !== JobType.INSTALL) {
            throw new BadRequestException(
                'Only INSTALL is currently supported for services',
            );
        }

        const job = await this.prisma.$transaction(async (tx) => {
            // Serialize installation requests for the same service.
            const lockedServices = await tx.$queryRaw<
                Array<{ id: string }>
            >`
                SELECT "id"
                FROM "Service"
                WHERE "id" = ${serviceId}
                  AND "userId" = ${userId}
                FOR UPDATE
            `;

            if (lockedServices.length === 0) {
                throw new NotFoundException('Service not found');
            }

            const service = await tx.service.findUnique({
                where: { id: serviceId },
                select: {
                    id: true,
                    nodeId: true,
                    eggId: true,
                    dockerImage: true,
                    memoryMb: true,
                    cpuPercent: true,
                    diskMb: true,
                    installStatus: true,
                    category: {
                        select: {
                            key: true,
                        },
                    },
                },
            });

            if (!service) {
                throw new NotFoundException('Service not found');
            }

            if (
                service.installStatus !== 'DRAFT' &&
                service.installStatus !== 'FAILED'
            ) {
                throw new ConflictException(
                    'Service is not ready for installation',
                );
            }

            if (!service.eggId) {
                throw new BadRequestException(
                    'Service has no assigned egg',
                );
            }

            const eggReference = await tx.egg.findUnique({
                where: { id: service.eggId },
                select: {
                    repositoryId: true,
                },
            });

            if (!eggReference) {
                throw new NotFoundException('Egg not found');
            }

            // Maintain lock order: Service -> EggRepository.
            const lockedRepositories = await tx.$queryRaw<
                Array<{ id: string }>
            >`
                SELECT "id"
                FROM "EggRepository"
                WHERE "id" = ${eggReference.repositoryId}
                FOR UPDATE
            `;

            if (lockedRepositories.length === 0) {
                throw new NotFoundException(
                    'Egg repository not found',
                );
            }

            const egg = await tx.egg.findUnique({
                where: { id: service.eggId },
                select: {
                    id: true,
                    key: true,
                    version: true,
                    isEnabled: true,
                    manifest: true,
                    repository: {
                        select: {
                            status: true,
                        },
                    },
                },
            });

            if (!egg) {
                throw new NotFoundException('Egg not found');
            }

            if (
                !egg.isEnabled ||
                egg.repository.status !== 'ENABLED'
            ) {
                throw new ConflictException(
                    'Egg or its repository is disabled',
                );
            }

            // Revalidate the stored manifest before capturing it.
            const validated = validateEggManifest(egg.manifest);
            const manifest =
                validated.manifest as unknown as InstallManifest;

            if (manifest.category !== service.category.key) {
                throw new BadRequestException(
                    'Egg category does not match service category',
                );
            }

            if (
                validated.key !== egg.key ||
                validated.version !== egg.version
            ) {
                throw new BadRequestException(
                    'Egg metadata does not match its manifest',
                );
            }

            if (!service.nodeId) {
                throw new BadRequestException(
                    'Service has no assigned node',
                );
            }

            if (
                !service.dockerImage?.trim() ||
                service.dockerImage !== manifest.runtime.image.trim()
            ) {
                throw new BadRequestException(
                    'Service Docker image does not match its egg',
                );
            }

            if (
                service.memoryMb === null ||
                !Number.isSafeInteger(service.memoryMb) ||
                service.memoryMb <= 0 ||
                service.cpuPercent === null ||
                !Number.isSafeInteger(service.cpuPercent) ||
                service.cpuPercent <= 0 ||
                service.diskMb === null ||
                !Number.isSafeInteger(service.diskMb) ||
                service.diskMb <= 0
            ) {
                throw new BadRequestException(
                    'Service has invalid resource limits',
                );
            }

            const existingJob = await tx.job.findFirst({
                where: {
                    serviceId,
                    type: JobType.INSTALL,
                    status: {
                        in: [
                            'PENDING',
                            'DISPATCHING',
                            'QUEUED',
                            'RUNNING',
                        ],
                    },
                },
                select: {
                    id: true,
                },
            });

            if (existingJob) {
                throw new ConflictException(
                    'An installation job already exists',
                );
            }

            // Capture only non-secret installation data.
            // Variable values are deliberately excluded.
            const installConfig: Prisma.InputJsonObject = {
                formatVersion: 1,
                egg: {
                    id: egg.id,
                    key: egg.key,
                    version: egg.version,
                },
                nodeId: service.nodeId,
                runtime: {
                    image: manifest.runtime.image.trim(),
                    startup: manifest.runtime.startup,
                },
                resources: {
                    memoryMb: service.memoryMb,
                    cpuPercent: service.cpuPercent,
                    diskMb: service.diskMb,
                },
                variables: (manifest.variables ?? []).map(
                    (variable) => ({
                        name: variable.name,
                        required: variable.required,
                        secret: variable.secret,
                    }),
                ),
            };

            // Database record only. No Agent or Docker execution.
            return tx.job.create({
                data: {
                    userId,
                    serviceId,
                    type: JobType.INSTALL,
                    status: 'PENDING',
                    progress: 0,
                    installConfig,
                },
            });
        });

        // Notify only after the transaction has committed.
        // Notification failures must not invalidate the created job.
        await this.notifyInstallQueued(userId, serviceId);

        return job;
    }
}
