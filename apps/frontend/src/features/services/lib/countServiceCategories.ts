import type { UserService } from '@/features/services/api/services.api';

export type ServiceCategoryKey = 'server' | 'discord_bot' | 'telegram_bot' | 'other';

// A linked legacy server is counted only once, via its Service record.
export function countServiceCategories(services: UserService[], standaloneLegacyServerCount: number): Record<ServiceCategoryKey, number> {
    const counts: Record<ServiceCategoryKey, number> = {
        server: standaloneLegacyServerCount, discord_bot: 0, telegram_bot: 0, other: 0,
    };
    for (const service of services) {
        const key = service.category?.key;
        if (key && Object.prototype.hasOwnProperty.call(counts, key)) {
            counts[key as ServiceCategoryKey] += 1;
        }
    }
    return counts;
}
