/**
 * Identifies the origin of an Egg definition.
 * Provenance does not imply that the manifest is trusted.
 */
export type EggSourceType =
    | 'OFFICIAL'
    | 'COMMUNITY'
    | 'CUSTOM';

/**
 * Administrative review state.
 * Approval is independent of deployment availability.
 */
export type EggApprovalStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED';

/**
 * Safe, public-facing Egg metadata.
 * The manifest is intentionally excluded.
 */
export interface EggLibraryItem {
    id: string;
    key: string;
    name: string;
    description: string | null;
    version: string;
    repositoryId: string;
    sourceType: EggSourceType;
    approvalStatus: EggApprovalStatus;
    ownerId: number | null;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Administrative decision on an Egg definition.
 */
export interface SetEggApprovalRequest {
    status: 'APPROVED' | 'REJECTED';
}
