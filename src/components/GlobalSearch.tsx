import { useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDomain, useFleet } from '../app/FleetProvider';
import { buildSearchIndex, searchIndex } from '../application/search';
export function GlobalSearch() {
  const state = useDomain();
  const { actor } = useFleet();
  const [query, setQuery] = useState('');
  const panel = useRef<HTMLDetailsElement>(null);
  const index = useMemo(() => buildSearchIndex(state), [state]);
  const results = searchIndex(index, query, actor);
  return (
    <details className="global-search" ref={panel}>
      <summary>Search fleet</summary>
      <div
        className="search-panel"
        onKeyDown={(event) => {
          const links = Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
          const current = links.indexOf(document.activeElement as HTMLAnchorElement);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            links[
              (current + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length
            ]?.focus();
          }
          if (event.key === 'Escape' && panel.current) {
            panel.current.open = false;
            panel.current.querySelector('summary')?.focus();
          }
        }}
      >
        <label>
          Search all operations
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <ul>
          {results.map((entry, i) => (
            <li key={entry.kind + entry.id}>
              {results[i - 1]?.kind !== entry.kind && <strong>{entry.kind}</strong>}
              <Link
                to={entry.href}
                onClick={() => {
                  if (panel.current) panel.current.open = false;
                }}
              >
                {entry.id}: {entry.label}
              </Link>
            </li>
          ))}
        </ul>
        {query && !results.length && <p>No matching operations in your scope.</p>}
      </div>
    </details>
  );
}
