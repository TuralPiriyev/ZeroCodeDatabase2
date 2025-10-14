export function useKeyCombo(callback: (e: KeyboardEvent) => void, combos: Array<{ key: string; ctrl?: boolean; meta?: boolean }>) {
  const handler = (e: KeyboardEvent) => {
    for (const c of combos) {
      const ctrlOk = (c.ctrl ? (e.ctrlKey || e.metaKey) : true);
      if (ctrlOk && e.key === c.key) {
        callback(e);
        break;
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

export function useDebouncedCallback(fn: (...args: any[]) => void, wait = 250) {
  let t: any = null;
  return (...args: any[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export default {};
