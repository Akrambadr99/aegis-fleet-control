import { expect, it } from 'vitest';
import { cursorCollection, hiddenSelection } from './collections';
it('rejects cursors after collection changes and keeps hidden selection separate', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
  const first = cursorCollection(rows, 1, undefined, 20);
  expect(first.items).toHaveLength(20);
  const next = cursorCollection(rows, 1, first.next, 20);
  expect(next.items[0].id).toBe('20');
  expect(() => cursorCollection(rows, 2, first.next, 20)).toThrow('Collection changed');
  expect(hiddenSelection(new Set(['0', '20', '999']), next.items)).toEqual(['0', '999']);
});
