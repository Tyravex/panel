import { ConflictException } from '@nestjs/common';

import type { EggApprovalStatus } from '@shared/types';

/**
 * Ensures that an Egg has passed administrative review.
 *
 * Approval is required before enabling an Egg or using it
 * for service provisioning.
 *
 * This function does not verify repository availability,
 * ownership, permissions, or manifest integrity.
 */
export function assertEggApproved(
    approvalStatus: EggApprovalStatus,
): void {
    if (approvalStatus !== 'APPROVED') {
        throw new ConflictException(
            'Egg must be approved before use',
        );
    }
}
