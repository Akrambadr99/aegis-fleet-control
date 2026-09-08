import { useEffect, useRef } from 'react';
const directions: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  w: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
};
export function useMotionKeyboard(
  enabled: boolean,
  move: (dx: number, dy: number) => Promise<void>,
) {
  const callback = useRef(move);
  callback.current = move;
  useEffect(() => {
    if (!enabled) return;
    const held = new Set<string>();
    let busy = false;
    const send = async () => {
      if (busy || !held.size) return;
      const [dx, dy] = [...held].reduce(
        (sum, key) => [sum[0] + directions[key][0], sum[1] + directions[key][1]],
        [0, 0],
      );
      if (!dx && !dy) return;
      busy = true;
      try {
        await callback.current(Math.sign(dx), Math.sign(dy));
      } finally {
        busy = false;
      }
    };
    const down = (event: KeyboardEvent) => {
      if (
        !directions[event.key] ||
        (event.target instanceof HTMLElement &&
          event.target.matches('input,select,textarea,[contenteditable="true"]'))
      )
        return;
      event.preventDefault();
      held.add(event.key);
      void send();
    };
    const up = (event: KeyboardEvent) => held.delete(event.key),
      clear = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    const interval = window.setInterval(send, 300);
    return () => {
      clear();
      clearInterval(interval);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, [enabled]);
}
