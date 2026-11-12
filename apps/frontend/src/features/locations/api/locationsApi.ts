import type {
  CreateLocationRequest,
  LocationRecord,
  UpdateLocationRequest,
} from '@shared/types';
import { api } from '@/shared/api/client';

export const locationsApi = {
  async list(signal?: AbortSignal): Promise<LocationRecord[]> {
    const response = await api.get<LocationRecord[]>('/locations', {
      signal,
    });

    return response.data;
  },

  async getById(
    id: string,
    signal?: AbortSignal,
  ): Promise<LocationRecord> {
    const response = await api.get<LocationRecord>(
      `/locations/${encodeURIComponent(id)}`,
      { signal },
    );

    return response.data;
  },

  async create(
    payload: CreateLocationRequest,
  ): Promise<LocationRecord> {
    const response = await api.post<LocationRecord>(
      '/locations',
      payload,
    );

    return response.data;
  },

  async update(
    id: string,
    payload: UpdateLocationRequest,
  ): Promise<LocationRecord> {
    const response = await api.patch<LocationRecord>(
      `/locations/${encodeURIComponent(id)}`,
      payload,
    );

    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/locations/${encodeURIComponent(id)}`);
  },
};
