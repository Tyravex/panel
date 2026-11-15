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

export interface EggManifest {
    format: 'tyravex-egg'; formatVersion: 1; id: string; name: string; version: string;
    category: string; description?: string;
    runtime: { image: string; startup: string };
    resources: { memoryMb: number; cpuPercent: number; diskMb: number };
    variables?: { name: string; required: boolean; secret: boolean }[];
    catalog?: import('./egg-catalog.types').EggCatalogOptions;
}

export interface AdminEgg extends EggLibraryItem {
    manifest: EggManifest;
    _count?: { services: number };
    provenance?: import('./egg-catalog.types').EggProvenance | null;
}

export interface EggRepository {
    id: string; name: string; url: string; isOfficial: boolean; status: 'ENABLED' | 'DISABLED';
    _count?: { eggs: number };
}

export interface EggRepositoryPreview {
    repositoryId: string;
    digest: string;
    commit: string | null;
    entries: { path: string; key: string; version: string; manifest: EggManifest | null; state: 'NEW' | 'EXISTS' | 'CONFLICT' | 'INVALID'; error?: string; sha256?: string; sourceUrl?: string }[];
}
