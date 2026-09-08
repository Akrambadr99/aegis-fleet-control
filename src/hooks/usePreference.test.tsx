import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { usePreference } from './usePreference';
const number = (value: unknown): value is number => typeof value === 'number';
it('keeps preference keys isolated and tolerates malformed persisted values', () => {
  localStorage.setItem('aegis.preference.a', 'broken');
  localStorage.setItem('aegis.preference.b', JSON.stringify({ version: 1, value: 8 }));
  const hook = renderHook(({ key }) => usePreference(key, 1, number), {
    initialProps: { key: 'a' },
  });
  expect(hook.result.current[0]).toBe(1);
  act(() => hook.result.current[1](5));
  hook.rerender({ key: 'b' });
  expect(hook.result.current[0]).toBe(8);
  hook.rerender({ key: 'a' });
  expect(hook.result.current[0]).toBe(5);
  hook.unmount();
  const restored = renderHook(() => usePreference('a', 1, number));
  expect(restored.result.current[0]).toBe(5);
  restored.unmount();
  localStorage.removeItem('aegis.preference.a');
  localStorage.removeItem('aegis.preference.b');
});
