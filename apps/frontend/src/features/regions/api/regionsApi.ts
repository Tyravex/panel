import type {
  CreateRegionRequest,
  RegionRecord,
  UpdateRegionRequest,
} from '@shared/types';
import { api } from '@/shared/api/client';

export const regionsApi = {
  async list(signal?: AbortSignal): Promise<RegionRecord[]> {
    const response = await api.get<RegionRecord[]>('/regions', {
      signal,
    });

    return response.data;
  },

  async getById(
    id: string,
    signal?: AbortSignal,
  ): Promise<RegionRecord> {
    const response = await api.get<RegionRecord>(
      `/regions/${encodeURIComponent(id)}`,
      { signal },
    );

    return response.data;
  },

  async create(
    payload: CreateRegionRequest,
  ): Promise<void> {
    await api.post('/regions', payload);
  },

  async update(
    id: string,
    payload: UpdateRegionRequest,
  ): Promise<void> {
    await api.patch(
      `/regions/${encodeURIComponent(id)}`,
      payload,
    );
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/regions/${encodeURIComponent(id)}`);
  },
};