import { useSearchParams } from 'react-router-dom';
import { pageCollection } from '../application/collections';
export function useCollectionPage<T extends { id: string }>(
  rows: readonly T[],
  key: string,
  size = 25,
) {
  const [params, setParams] = useSearchParams();
  const page = pageCollection(rows, Number(params.get(key)), size);
  return {
    ...page,
    setPage: (value: number) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, String(value));
        return next;
      }),
  };
}
