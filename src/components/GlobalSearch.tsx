import { useMemo, useState, useRef, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useDomain, useFleet } from '../app/FleetProvider';
import { buildSearchIndex, searchIndex } from '../application/search';
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDetailsElement>(null);
  return (
    <details
      className="global-search"
      ref={panel}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Search fleet</summary>
      {open && <SearchPanel panel={panel} />}
    </details>
  );
}
function SearchPanel({ panel }: { panel: RefObject<HTMLDetailsElement | null> }) {
  const state = useDomain();
  const { actor } = useFleet();
  const [query, setQuery] = useState('');

  const index = useMemo(() => buildSearchIndex(state), [state]);
  const results = searchIndex(index, query, actor);
  return (
    <div
      className="search-panel"
      onKeyDown={(event) => {
        const links = Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
        const current = links.indexOf(document.activeElement as HTMLAnchorElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          links[
            current < 0
              ? event.key === 'ArrowDown'
                ? 0
                : links.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length
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
  );
}
