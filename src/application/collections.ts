import { DomainError } from '../domain/errors';
export function pageCollection<T extends { id: string }>(
  rows: readonly T[],
  requested = 0,
  size = 25,
) {
  if (!Number.isInteger(size) || size < 1 || size > 500)
    throw new DomainError('invalid', 'Page size must be 1–500');
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(
    0,
    Math.min(Number.isFinite(requested) ? Math.floor(requested) : 0, pages - 1),
  );
  return { items: rows.slice(page * size, (page + 1) * size), page, pages, total: rows.length };
}
export function cursorCollection<T extends { id: string }>(
  rows: readonly T[],
  revision: number,
  cursor?: string,
  size = 25,
) {
  let page = 0;
  if (cursor) {
    try {
      const decoded = JSON.parse(decodeURIComponent(cursor));
      if (decoded.revision !== revision)
        throw new DomainError('stale', 'Collection changed; restart pagination');
      if (!Number.isInteger(decoded.page) || decoded.page < 0) throw new Error();
      page = decoded.page;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('invalid', 'Invalid collection cursor');
    }
  }
  const result = pageCollection(rows, page, size);
  return {
    ...result,
    next:
      result.page + 1 < result.pages
        ? encodeURIComponent(JSON.stringify({ revision, page: result.page + 1 }))
        : undefined,
  };
}
export function hiddenSelection(selected: ReadonlySet<string>, visible: readonly { id: string }[]) {
  const ids = new Set(visible.map((row) => row.id));
  return [...selected].filter((id) => !ids.has(id));
}
