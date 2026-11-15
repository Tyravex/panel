import { describe, expect, it } from 'vitest';
import { getRoleChanges } from './roleChanges';

const read = { id: 'read', name: 'user:read' };
const audit = { id: 'audit', name: 'audit:read' };
const role = { id: 'support', name: 'Support', permissions: [read] };

describe('Role change review', () => {
  it('distinguishes additions, removals and a trimmed rename', () => {
    expect(getRoleChanges(role, { name: ' Support Team ', permissionIds: ['audit'] }, [read, audit]))
      .toEqual({ previousName: 'Support', nextName: 'Support Team', added: [audit], removed: [read], changed: true });
  });

  it('does not treat ordering or surrounding whitespace as changes', () => {
    expect(getRoleChanges({ ...role, permissions: [read, audit] }, {
      name: 'Support ', permissionIds: ['audit', 'read'],
    }, [read, audit]).changed).toBe(false);
  });

  it('preserves names of removed permissions that are missing from the catalog', () => {
    const changes = getRoleChanges(role, { name: 'Support', permissionIds: [] }, []);
    expect(changes.removed).toEqual([read]);
    expect(changes.added).toEqual([]);
  });
});
