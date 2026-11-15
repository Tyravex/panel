// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { appRoutes } from './routes';

describe('Modular route composition', () => {
  it.each([
    ['/admin/services/new', '/admin/services/new'],
    ['/admin/services/s1/edit', '/admin/services/:id/edit'],
    ['/admin/services/s1/owner', '/admin/services/:id/owner'],
    ['/admin/services/s1/installation', '/admin/services/:id/installation'],
    ['/admin/eggs/import', '/admin/eggs/import'],
    ['/admin/eggs/repositories/new', '/admin/eggs/repositories/new'],
    ['/admin/eggs/repositories/r1/edit', '/admin/eggs/repositories/:id/edit'],
    ['/admin/eggs/e1/edit', '/admin/eggs/:id/edit'],
    ['/admin/roles/compare', '/admin/roles/compare'],
    ['/admin/users/42/roles', '/admin/users/:id/roles'],
    ['/admin/nodes/new', '/admin/nodes/new'],
    ['/services/s1', '/services/:id'],
  ])('resolves %s without shadowing it with a dynamic route', (url, expected) => {
    const matches = matchRoutes(appRoutes, url)!;
    expect(matches[matches.length - 1].route.path).toBe(expected);
  });
});
