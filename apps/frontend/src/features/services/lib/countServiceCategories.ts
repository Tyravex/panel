import type { UserService } from '@/features/services/api/services.api';

export type ServiceCategoryKey = 'server' | 'discord_bot' | 'telegram_bot' | 'other';

// Count only canonical Service records; no legacy Server reconciliation.
export function countServiceCategories(
    services: UserService[],
): Record<ServiceCategoryKey, number> {
    const counts: Record<ServiceCategoryKey, number> = {
        server: 0,
        discord_bot: 0,
        telegram_bot: 0,
        other: 0,
    };

    for (const service of services) {
        const key = service.category?.key;
        if (key === 'server' || key === 'discord_bot' || key === 'telegram_bot') {
            counts[key] += 1;
        } else {
            counts.other += 1;
        }
    }

    return counts;
}
