export interface MarketplacePluginUpdate {
    pluginId: string;
    installedVersion: string;
    availableVersion: string;
    repositoryId: string;
    downloadUrl: string;
    sha256: string;
}

export interface MarketplaceUpdatesResponse {
    updates: MarketplacePluginUpdate[];
}