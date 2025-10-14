import { useCallback, useEffect, useRef, useState } from 'react';

export type PanelState = { id: string; x: number; y: number; width?: number; height?: number; pinned: boolean; open: boolean };

const STORAGE_KEY = 'zc_panels_state_v1';

export function readPersisted(): PanelState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PanelState[];
  } catch (err) {
    console.warn('failed to read panels state', err);
    return [];
  }
}

export function writePersisted(states: PanelState[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch (err) {
    console.warn('failed to write panels state', err);
  }
}

export default function useDraggablePanel(id: string, initial: { x: number; y: number; pinned?: boolean } = { x: 120, y: 120, pinned: false }) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const persisted = readPersisted().find(p => p.id === id);
    return persisted ? { x: persisted.x, y: persisted.y } : { x: initial.x, y: initial.y };
  });
  const [pinned, setPinned] = useState<boolean>(() => {
    const persisted = readPersisted().find(p => p.id === id);
    return persisted ? !!persisted.pinned : !!initial.pinned;
  });
  const [open, setOpen] = useState<boolean>(() => {
    const persisted = readPersisted().find(p => p.id === id);
    return persisted ? !!persisted.open : true;
  });

  const draggingRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // persist on change, debounced
    const handler = setTimeout(() => {
      const all = readPersisted().filter(p => p.id !== id).concat({ id, x: pos.x, y: pos.y, pinned, open });
      writePersisted(all);
    }, 250);
    return () => clearTimeout(handler);
  }, [id, pos.x, pos.y, pinned, open]);

  const onPointerDown = useCallback((e: React.PointerEvent, el: HTMLElement) => {
    el.setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();
    draggingRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };

    const handlePointerMove = (ev: PointerEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setPos({ x: Math.max(8, ev.clientX - d.offsetX), y: Math.max(8, ev.clientY - d.offsetY) });
      });
    };

    const handlePointerUp = (ev: PointerEvent) => {
      el.releasePointerCapture?.(e.pointerId);
      draggingRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      // snap to left if near
      const SNAP_THRESHOLD = 64;
      if (ev.clientX < SNAP_THRESHOLD) setPos(p => ({ ...p, x: 8 }));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, []);

  const togglePinned = useCallback(() => setPinned(p => !p), []);
  const close = useCallback(() => setOpen(false), []);
  const openPanel = useCallback(() => setOpen(true), []);

  return { pos, setPos, pinned, togglePinned, close, openPanel, open, onPointerDown };
}
