import { useEffect, useRef, useState } from 'react';
import { formatRupees } from '../money/money';

const DURATION_MS = 700;

/** Shows a rupee amount and counts to the new value whenever it changes. The first render is not animated. */
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (typeof requestAnimationFrame !== 'function') {
      from.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = () => {
      // Use the same clock as t0; the timestamp rAF passes can use a different time origin.
      const p = Math.min(1, (performance.now() - t0) / DURATION_MS);
      const eased = 1 - (1 - p) ** 3;
      const v = Math.round(start + (value - start) * eased);
      from.current = v;
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span data-value={value}>{formatRupees(shown)}</span>;
}
