import { api } from '@/shared/api/client';
import type { AdminEgg, EggCatalogItem, EggManifest, EggRepository, EggRepositoryPreview, EggTag, EggTagColor } from '@shared/types';

export interface EggPage { items: EggCatalogItem[]; pagination: { page: number; totalPages: number; total: number; hasNextPage: boolean; hasPreviousPage: boolean } }
export const eggsApi = {
  async list(query = '', page = 1, signal?: AbortSignal, filters: { category?: string; tag?: string } = {}): Promise<EggPage> { return (await api.get<EggPage>('/admin/egg-catalog', { params: { query, page, ...filters }, signal })).data; },
  async tags(signal?: AbortSignal): Promise<EggTag[]> { return (await api.get<EggTag[]>('/egg-tags', { signal })).data; },
  async eggTags(id: string): Promise<EggTag[]> { return (await api.get<EggTag[]>(`/egg-tags/eggs/${encodeURIComponent(id)}`)).data; },
  async mine(): Promise<{ id: string; name: string; version: string }[]> { return (await api.get('/eggs/mine')).data; },
  async createTag(name: string, color: EggTagColor, shared: boolean): Promise<EggTag> { return (await api.post<EggTag>('/egg-tags', { name, color, shared })).data; },
  async updateTag(id: string, name: string, color: EggTagColor): Promise<EggTag> { return (await api.patch<EggTag>(`/egg-tags/${encodeURIComponent(id)}`, { name, color })).data; },
  async removeTag(id: string) { await api.delete(`/egg-tags/${encodeURIComponent(id)}`); },
  async assignTags(id: string, tagIds: string[]) { await api.put(`/egg-tags/eggs/${encodeURIComponent(id)}`, { tagIds }); },
  async archiveRepository(id: string) { await api.post(`/admin/egg-catalog/repositories/${encodeURIComponent(id)}/archive`); },
  async checkOfficialUpdates(id: string) { await api.post(`/admin/egg-settings/${encodeURIComponent(id)}/check`); },
  async versions(id: string): Promise<{ id: string; version: string; approvalStatus: string; isEnabled: boolean }[]> { return (await api.get(`/admin/egg-catalog/${encodeURIComponent(id)}/versions`)).data; },
  async get(id: string, signal?: AbortSignal): Promise<AdminEgg> { return (await api.get<AdminEgg>(`/admin/eggs/${encodeURIComponent(id)}/manifest`, { signal })).data; },
  async repositories(signal?: AbortSignal): Promise<EggRepository[]> { return (await api.get<EggRepository[]>('/egg-repositories', { signal })).data; },
  async addRepository(name: string, url: string): Promise<EggRepository> { return (await api.post<EggRepository>('/egg-repositories', { name, url })).data; },
  async renameRepository(id: string, name: string) { await api.patch(`/admin/eggs/repositories/${encodeURIComponent(id)}`, { name }); },
  async repositoryStatus(id: string, status: EggRepository['status']) { await api.patch(`/egg-repositories/${encodeURIComponent(id)}/status`, { status }); },
  async validate(manifest: unknown) { return (await api.post('/admin/eggs/validate', manifest)).data; },
  async import(repository: string, manifest: EggManifest): Promise<AdminEgg> { return (await api.post<AdminEgg>(`/egg-repositories/${encodeURIComponent(repository)}/eggs/import`, manifest)).data; },
  async version(id: string, manifest: EggManifest): Promise<AdminEgg> { return (await api.post<AdminEgg>(`/admin/eggs/${encodeURIComponent(id)}/versions`, manifest)).data; },
  async approve(id: string, status: 'APPROVED' | 'REJECTED') { await api.patch(`/eggs/${encodeURIComponent(id)}/approval`, { status }); },
  async enable(id: string, isEnabled: boolean) { await api.patch(`/eggs/${encodeURIComponent(id)}/status`, { isEnabled }); },
  async preview(id: string): Promise<EggRepositoryPreview> { return (await api.post<EggRepositoryPreview>(`/admin/eggs/repositories/${encodeURIComponent(id)}/preview`)).data; },
  async sync(id: string, paths: string[], digest: string): Promise<{ imported: number; skipped: number }> { return (await api.post<{ imported: number; skipped: number }>(`/admin/eggs/repositories/${encodeURIComponent(id)}/sync`, { paths, digest })).data; },
};
