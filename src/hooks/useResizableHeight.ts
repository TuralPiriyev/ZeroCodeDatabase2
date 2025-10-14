import { useEffect, useRef, useState } from 'react';

function useLocalStorageNumber(key: string, initial: number) {
  const [value, setValue] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? Number(raw) : initial;
    } catch (e) {
      return initial;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, String(value)); } catch (e) {}
  }, [key, value]);

  return [value, setValue] as const;
}

export default function useResizableHeight(key: string, initial = 480) {
  const [height, setHeight] = useLocalStorageNumber(key, initial);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!handleRef.current) return;
      if (e.target !== handleRef.current && !(handleRef.current.contains(e.target as Node))) return;
      draggingRef.current = { startY: e.clientY, startHeight: height };
      try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) {}
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const d = draggingRef.current;
      const newH = Math.max(200, d.startHeight + (e.clientY - d.startY));
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setHeight(newH);
      });
    };

    const handlePointerUp = (_e: PointerEvent) => {
      draggingRef.current = null;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [height]);

  return { height, setHeight, handleRef };
}
