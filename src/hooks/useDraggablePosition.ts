import { useCallback, useEffect, useRef, useState } from 'react';

export type Position = { x: number; y: number };

export interface UseDraggableOptions {
  key?: string; // localStorage key
  defaultPosition?: Position;
  snapThreshold?: number; // px
  snapToLeft?: boolean;
}

export function useDraggablePosition(options: UseDraggableOptions = {}) {
  const { key = 'toolbox-pos', defaultPosition = { x: 24, y: 120 }, snapThreshold = 64 } = options;
  const [position, setPosition] = useState<Position>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as Position;
    } catch (e) { /* ignore */ }
    return defaultPosition;
  });

  const [pinned, setPinned] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`${key}:pinned`);
      if (raw) return JSON.parse(raw) as boolean;
    } catch (e) {}
    return false;
  });

  const draggingRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const save = useCallback((pos: Position, pin?: boolean) => {
    try {
      localStorage.setItem(key, JSON.stringify(pos));
      if (typeof pin === 'boolean') localStorage.setItem(`${key}:pinned`, JSON.stringify(pin));
    } catch (e) { /* ignore */ }
  }, [key]);

  useEffect(() => save(position, pinned), [position, pinned, save]);

  const startDrag = useCallback((e: PointerEvent | React.PointerEvent, elemRect: DOMRect) => {
    const evt = e as PointerEvent;
    const clientX = (evt as any).clientX ?? (e as React.PointerEvent).clientX;
    const clientY = (evt as any).clientY ?? (e as React.PointerEvent).clientY;
    const offsetX = clientX - elemRect.left;
    const offsetY = clientY - elemRect.top;
    draggingRef.current = { pointerId: (evt as any).pointerId ?? -1, offsetX, offsetY };
  }, []);

  const stopDrag = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const onPointerMove = useCallback((clientX: number, clientY: number) => {
    const d = draggingRef.current;
    if (!d) return;
    // compute new top-left such that pointer remains at same offset
    const newX = Math.max(8, clientX - d.offsetX);
    const newY = Math.max(8, clientY - d.offsetY);

    // Snap to left if within threshold
    if (newX <= snapThreshold) {
      setPosition({ x: 8, y: newY });
    } else {
      setPosition({ x: newX, y: newY });
    }
  }, [snapThreshold]);

  // pointer handlers for use by component
  const handlePointerDown = useCallback((e: React.PointerEvent, containerRef: React.RefObject<HTMLElement>) => {
    const target = containerRef.current;
    if (!target) return;
    try { target.setPointerCapture(e.pointerId); } catch (err) {}
    const rect = target.getBoundingClientRect();
    startDrag(e as unknown as PointerEvent, rect);

    const move = (ev: PointerEvent) => {
      onPointerMove(ev.clientX, ev.clientY);
    };

    const up = () => {
      try { target.releasePointerCapture(e.pointerId); } catch (err) {}
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      stopDrag();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [onPointerMove, startDrag, stopDrag]);

  const togglePinned = useCallback((next?: boolean) => {
    setPinned(p => {
      const v = typeof next === 'boolean' ? next : !p;
      try { localStorage.setItem(`${key}:pinned`, JSON.stringify(v)); } catch (e) {}
      return v;
    });
  }, [key]);

  return {
    position,
    setPosition,
    pinned,
    togglePinned,
    handlePointerDown,
    stopDrag,
    startDrag,
  } as const;
}

export default useDraggablePosition;
