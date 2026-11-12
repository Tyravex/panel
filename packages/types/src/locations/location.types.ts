export interface LocationRecord {
  id: string;
  name: string;
  code: string;
  continent: string;
  country: string;
  state: string | null;
  city: string | null;
  regionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationRequest {
  name: string;
  code: string;
  continent: string;
  country: string;
  state?: string | null;
  city?: string | null;
  regionId: string;
}
export interface UpdateLocationRequest {
  name?: string;
  code?: string;
  continent?: string;
  country?: string;
  state?: string | null;
  city?: string | null;
  regionId?: string;
}