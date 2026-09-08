import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { buildSearchIndex, searchIndex } from './search';
it('groups canonical entity types and filters by operator scope on each search', () => {
  const index = buildSearchIndex(createSeed());
  expect(new Set(index.map((e) => e.kind)).size).toBe(8);
  expect(searchIndex(index, 'R-001', { id: 'a', role: 'operator', facilityIds: [] })).toEqual([]);
  expect(searchIndex(index, 'R-001', { id: 'a', role: 'operator' })[0].href).toContain(
    'robot=R-001',
  );
});
