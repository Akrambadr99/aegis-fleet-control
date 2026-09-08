/** Reuse unchanged immutable branches so entity subscriptions retain identity. */
export function shareUnchanged<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (
    !previous ||
    !next ||
    typeof previous !== 'object' ||
    typeof next !== 'object' ||
    Array.isArray(previous) !== Array.isArray(next)
  )
    return next;
  const before = previous as Record<string, unknown>,
    after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  let equal = keys.length === Object.keys(before).length;
  for (const key of keys) {
    after[key] = shareUnchanged(before[key], after[key]);
    if (!Object.hasOwn(before, key) || after[key] !== before[key]) equal = false;
  }
  return equal ? previous : next;
}
