export type MarketplaceRepositoryStatus = 'ENABLED' | 'DISABLED';

export interface MarketplaceRepository {
    id: string;
    name: string;
    url: string;
    isOfficial: boolean;
    status: MarketplaceRepositoryStatus;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMarketplaceRepositoryRequest {
    name: string;
    url: string;
}

export interface UpdateMarketplaceRepositoryRequest {
    name?: string;
    status?: MarketplaceRepositoryStatus;
}

export interface MarketplaceRepositoriesResponse {
    repositories: MarketplaceRepository[];
}