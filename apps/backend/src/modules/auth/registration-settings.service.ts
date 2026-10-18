import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const REGISTRATION_KEY = 'registrationEnabled';

@Injectable()
export class RegistrationSettingsService {
    constructor(private readonly prisma: PrismaService) { }

    async isRegistrationEnabled(): Promise<boolean> {
        // Missing settings default to disabled; database errors propagate (fail closed).
        const setting = await this.prisma.panelSetting.findUnique({
            where: { key: REGISTRATION_KEY },
            select: { booleanValue: true },
        });
        return setting?.booleanValue === true;
    }

    async setRegistrationEnabled(
        enabled: unknown,
        actorId: number,
    ): Promise<{ registrationEnabled: boolean }> {
        if (typeof enabled !== 'boolean') {
            throw new BadRequestException('registrationEnabled must be a boolean');
        }
        if (!Number.isSafeInteger(actorId) || actorId <= 0) {
            throw new BadRequestException('Invalid administrator ID');
        }

        return this.prisma.$transaction(async (tx) => {
            // Serialize changes to avoid duplicate or misleading audit entries.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 2)::text`;
            const setting = await tx.panelSetting.findUnique({
                where: { key: REGISTRATION_KEY },
                select: { booleanValue: true },
            });
            const previous = setting?.booleanValue === true;

            if (previous !== enabled) {
                await tx.panelSetting.upsert({
                    where: { key: REGISTRATION_KEY },
                    create: { key: REGISTRATION_KEY, booleanValue: enabled },
                    update: { booleanValue: enabled },
                });
                await tx.adminAuditLog.create({
                    data: {
                        actorId,
                        action: 'REGISTRATION_SETTING_CHANGED',
                        targetType: 'PANEL_SETTING',
                        targetId: REGISTRATION_KEY,
                        metadata: { previous, enabled },
                    },
                });
            }
            return { registrationEnabled: enabled };
        });
    }
}
