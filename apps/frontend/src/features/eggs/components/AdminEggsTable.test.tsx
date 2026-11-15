// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EggCatalogItem } from '@shared/types';
import { AdminEggsTable } from './AdminEggsTable';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { version?: string }) => values?.version ? `${key} ${values.version}` : key }) }));
afterEach(cleanup);
const item = {
  id: 'egg-1', key: 'tyravex.discord.nodejs', name: 'Discord', description: 'Node.js bot runtime', version: '1.0.0', latestVersion: '1.1.0',
  category: 'discord_bot', repository: { id: 'repo-1', name: 'Tyravex Eggs', isOfficial: true, archivedAt: null },
  approvalStatus: 'APPROVED', isEnabled: true, serviceCount: 2,
  tags: [{ id: 'system:discord-bot', name: 'Discord Bot', color: 'violet', system: true, ownerId: null }]
} as EggCatalogItem;
describe('Egg catalog table', () => {
  it('shows the current version with the update underneath, official source and colored tags', () => {
    render(<MemoryRouter><AdminEggsTable items={[item]} /></MemoryRouter>);
    expect(screen.getByText('v1.0.0')).toBeTruthy(); expect(screen.getByText('eggs.updateAvailable 1.1.0')).toBeTruthy();
    expect(screen.getByText('eggs.officialRepository')).toBeTruthy(); expect(screen.getByText('Node.js bot runtime')).toBeTruthy();
    expect(screen.getByText('eggs.systemTags.discord-bot').className).toContain('violet');
    expect(screen.queryByRole('link', { name: 'eggs.edit' })).toBeNull();
  });
  it('only exposes editing actions when permission is provided', () => {
    render(<MemoryRouter><AdminEggsTable items={[item]} canManage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'eggs.edit' }).getAttribute('href')).toBe('/admin/eggs/egg-1/edit');
  });
});
