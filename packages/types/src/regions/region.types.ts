export interface RegionRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    locations: number;
    nodes: number;
  };
}

export interface CreateRegionRequest {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateRegionRequest {
  name?: string;
  code?: string;
  description?: string | null;
}
