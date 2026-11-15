import type { UserService } from '@/features/services/api/services.api';
import { getServiceKind, type ServiceKind } from './serviceKind';

export type ServiceCategoryKey = ServiceKind;

// Count only canonical Service records; no legacy Server reconciliation.
export function countServiceCategories(
    services: UserService[],
): Record<ServiceCategoryKey, number> {
    const counts: Record<ServiceCategoryKey, number> = {
        game: 0,
        bot: 0,
        voice: 0,
        other: 0,
    };

    for (const service of services) {
        counts[getServiceKind(service.category?.key)] += 1;
    }

    return counts;
}
