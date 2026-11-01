export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  type: string;
  version: string;
  downloadUrl: string;
  sha256: string;
  category?: string;
  source?: string;
}

export interface MarketplaceRegistry {
  schemaVersion: 1;
  plugins: MarketplacePlugin[];
}
