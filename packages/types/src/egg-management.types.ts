import type { EggLibraryItem, EggRepository } from './eggs.types';

export const EGG_TAG_COLORS = ['violet', 'blue', 'cyan', 'green', 'amber', 'rose', 'slate'] as const;
export type EggTagColor = typeof EGG_TAG_COLORS[number];
export interface EggTag {
  id: string; name: string; color: EggTagColor; system: boolean; ownerId: number | null;
}
export interface EggCatalogItem extends EggLibraryItem {
  category: string;
  repository: Pick<EggRepository, 'id' | 'name' | 'isOfficial'> & { archivedAt: string | null };
  latestVersion: string | null;
  tags: EggTag[];
  serviceCount: number;
}
export interface OfficialEggSettings {
  enabled: boolean;
  intervalHours: number;
  repositories: { id: string; name: string; status: string; lastCheckedAt: string | null; lastSyncAt: string | null; lastSyncError: string | null }[];
}
