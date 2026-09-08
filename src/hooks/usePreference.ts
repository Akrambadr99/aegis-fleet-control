import { useCallback, useEffect, useState } from 'react';
export function usePreference<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
) {
  const read = useCallback(() => {
    try {
      const item = JSON.parse(localStorage.getItem('aegis.preference.' + key) ?? 'null');
      return item?.version === 1 && validate(item.value) ? item.value : fallback;
    } catch {
      return fallback;
    }
  }, [key, fallback, validate]);
  const [stored, setStored] = useState(() => ({ key, value: read() }));
  const value = stored.key === key ? stored.value : read();
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === null || event.key === 'aegis.preference.' + key)
        setStored({ key, value: read() });
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [key, read]);
  function update(next: T) {
    setStored({ key, value: next });
    try {
      localStorage.setItem('aegis.preference.' + key, JSON.stringify({ version: 1, value: next }));
    } catch {
      /* Preference stays available for this workspace when storage is unavailable. */
    }
  }
  return [value, update] as const;
}
