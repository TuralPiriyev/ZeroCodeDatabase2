// src/utils/remoteCursors.ts
// Vanilla-TS module providing production-ready remote cursor overlays.
// Designed to be initialized with the existing socket wrapper and a workspace root DOM element.

type SocketLike = {
  on: (evt: string, h: (d: any) => void) => void;
  off: (evt: string, h: (d: any) => void) => void;
  // optional: expose onAny for debugging
  onAny?: (h: (evt: string, data: any) => void) => void;
};

export type RemoteCursorOptions = {
  inactivityTimeout?: number; // ms
  maxRate?: number; // updates per second
  smoothing?: number; // 0..1 lerp factor
  dev?: boolean;
};

// Simple utility to inject minimal CSS once
function injectCss() {
  if ((window as any).__remoteCursorsCssInjected) return;
  (window as any).__remoteCursorsCssInjected = true;
  const css = `
  .rc-cursor { position: absolute; pointer-events: none; transform: translate3d(0,0,0); will-change: transform, opacity; }
  .rc-dot { width:10px;height:10px;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.12);transform:translate(-50%,-50%); }
  .rc-badge { display:inline-block; background: rgba(0,0,0,0.7); color: #fff; padding:4px 8px; border-radius:8px; font-size:12px; margin-top:8px; white-space:nowrap; }
  .rc-avatar { width:22px;height:22px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-weight:600;color:#fff;font-size:12px;margin-right:6px; }
  .rc-wrapper { display:flex; align-items:center; gap:6px; }
  .rc-hidden { opacity:0; pointer-events:none; }
  `;
  const s = document.createElement('style');
  s.setAttribute('data-rc','1');
  s.textContent = css;
  document.head.appendChild(s);
}

// Normalized canonical cursor payload
export type CanonicalCursor = {
  userId: string;
  displayName?: string;
  avatar?: string | null;
  color?: string | null;
  coordsType: 'normalized' | 'page' | 'client';
  x: number; // if normalized => 0..1, else page/client px
  y: number;
  timestamp?: number;
};

// Track seen malformed signatures to avoid repeated warnings
const seenMalformed = new Set<string>();

function summarizeRaw(raw: any) {
  try {
    if (!raw) return 'null';
    if (typeof raw === 'string') return raw.slice(0, 200);
    const keys = Object.keys(raw || {}).slice(0,6);
    return `{${keys.join(',')}}`;
  } catch (e) { return 'raw'; }
}

// Accept many shapes and return CanonicalCursor or null
export function normalizeCursorPayload(raw: any, dev = false): CanonicalCursor | null {
  if (!raw || typeof raw !== 'object') return null;

  // Unwrap common wrappers
  const candidates = [raw];
  // message wrappers
  if (raw.message) candidates.push(raw.message);
  if (raw.data) candidates.push(raw.data);
  if (raw.payload) candidates.push(raw.payload);
  if (raw.msg) candidates.push(raw.msg);

  for (const cand of candidates) {
    if (!cand || typeof cand !== 'object') continue;

    // If cand has a top-level 'cursor' use that
    const cursor = (cand.cursor && typeof cand.cursor === 'object') ? cand.cursor : null;
    const source = cursor || cand;

    // extract identifiers
    const userId = source.userId || source.uid || source.id || source.user?.id || source.userId;
    if (!userId || typeof userId !== 'string') continue;

    const displayName = source.displayName || source.name || source.username || source.user?.displayName || source.user?.username || undefined;
    const avatar = source.avatar || source.avatarUrl || source.avatar_url || source.user?.avatar || source.user?.avatarUrl || null;
    const color = source.color || source.user?.color || null;

    // locate coordinates
    // many possible shapes: position: {x,y} | {x,y} top-level | clientX/pageX | normalized coords
    let coordsType: CanonicalCursor['coordsType'] = 'client';
    let x: any = null;
    let y: any = null;

    const pos = source.position || source.pos || null;
    if (pos && typeof pos === 'object') {
      x = pos.x ?? pos.clientX ?? pos.pageX ?? pos.nx ?? pos.normalizedX ?? pos.normalized_x ?? pos[0];
      y = pos.y ?? pos.clientY ?? pos.pageY ?? pos.ny ?? pos.normalizedY ?? pos.normalized_y ?? pos[1];
      if (pos.nx !== undefined || pos.ny !== undefined || pos.normalizedX !== undefined || pos.normalizedY !== undefined) coordsType = 'normalized';
    }

    if (x === null || y === null) {
      x = source.x ?? source.clientX ?? source.pageX ?? source.nx ?? source.normalizedX ?? source.normalized_x;
      y = source.y ?? source.clientY ?? source.pageY ?? source.ny ?? source.normalizedY ?? source.normalized_y;
      if (source.nx !== undefined || source.normalizedX !== undefined) coordsType = 'normalized';
    }

    // If still missing, check nested user.cursor etc
    if ((x === null || y === null) && source.user && typeof source.user === 'object') {
      x = x ?? source.user.x ?? source.user.clientX ?? source.user.pageX ?? source.user.nx;
      y = y ?? source.user.y ?? source.user.clientY ?? source.user.pageY ?? source.user.ny;
    }

    // Convert strings to numbers where possible
    if (typeof x === 'string') x = parseFloat(x);
    if (typeof y === 'string') y = parseFloat(y);

    // If normalized-ish range present but values >1 assume page/client and flip to client
    if (coordsType === 'normalized') {
      if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) continue;
      // accept normalized in [0..1]
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        // fall back to client coords
        coordsType = 'client';
      }
    }

    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) continue;

    const timestamp = source.timestamp ? (typeof source.timestamp === 'number' ? source.timestamp : Date.parse(source.timestamp)) : Date.now();

    return { userId: String(userId), displayName: displayName || undefined, avatar: avatar || null, color: color || null, coordsType, x, y, timestamp };
  }

  // If we reach here, the shape didn't match
  const signature = JSON.stringify(Object.keys(raw || {}).sort());
  if (!seenMalformed.has(signature)) {
    seenMalformed.add(signature);
    if (dev) console.debug('[RemoteCursors] ignored message — missing coords —', summarizeRaw(raw));
  }
  return null;
}

export function initRemoteCursors(socket: SocketLike, workspaceRoot: Element | string, opts?: RemoteCursorOptions) {
  injectCss();
  const options: Required<RemoteCursorOptions> = {
    inactivityTimeout: opts?.inactivityTimeout ?? 8000,
    maxRate: opts?.maxRate ?? 30,
    smoothing: opts?.smoothing ?? 0.18,
    dev: !!opts?.dev
  };

  let rootEl: Element | null = typeof workspaceRoot === 'string' ? document.querySelector(workspaceRoot) : workspaceRoot as Element;
  if (!rootEl) {
    console.error('[RemoteCursors] workspace root not found:', workspaceRoot);
    return { destroy: () => {}, toggle: () => {}, setDev: (_: boolean) => {} };
  }

  // root is non-null here
  const root = rootEl as HTMLElement;

  // container overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9999';
  overlay.className = 'rc-overlay';
  // ensure root is positioned
  root.style.position = (window.getComputedStyle(root).position === 'static') ? 'relative' : window.getComputedStyle(root).position;
  root.appendChild(overlay);

  type CursorState = {
    el: HTMLElement;
    dot: HTMLElement;
    badge: HTMLElement;
    avatarEl: HTMLElement;
    targetX: number;
    targetY: number;
    curX: number;
    curY: number;
    lastSeen: number;
    color?: string | null;
  };

  const cursors = new Map<string, CursorState>();

  function buildCursorEl(c: CanonicalCursor): CursorState {
    const wrapper = document.createElement('div');
    wrapper.className = 'rc-cursor';
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.transform = 'translate3d(-9999px,-9999px,0)';

    const inner = document.createElement('div');
    inner.className = 'rc-wrapper';

    const avatar = document.createElement('div');
    avatar.className = 'rc-avatar';
    avatar.style.background = c.color || '#7c3aed';
    if (c.avatar) {
      const img = document.createElement('img');
      img.src = c.avatar;
      img.style.width = '100%';
      img.style.height = '100%';
      img.onerror = () => { avatar.textContent = initials(c.displayName || c.userId); };
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(c.displayName || c.userId);
    }

    const dot = document.createElement('div');
    dot.className = 'rc-dot';
    dot.style.background = c.color || '#7c3aed';

    const badge = document.createElement('div');
    badge.className = 'rc-badge';
    badge.textContent = c.displayName || c.userId;

    inner.appendChild(avatar);
    inner.appendChild(badge);

    wrapper.appendChild(dot);
    wrapper.appendChild(inner);

    overlay.appendChild(wrapper);

  const rect = root.getBoundingClientRect();
    const initX = rect.left + (c.coordsType === 'normalized' ? c.x * rect.width : c.x) - window.scrollX;
    const initY = rect.top + (c.coordsType === 'normalized' ? c.y * rect.height : c.y) - window.scrollY;

    const state: CursorState = { el: wrapper, dot, badge, avatarEl: avatar, targetX: initX, targetY: initY, curX: initX, curY: initY, lastSeen: Date.now(), color: c.color };

  return state;
  }

  function initials(name: string) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0,2);
    return parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0,2);
  }

  // Convert canonical cursor coords to local coordinates relative to root's top-left
  function canonicalToLocal(c: CanonicalCursor) {
    const rect = root.getBoundingClientRect();
    const rootPageLeft = rect.left + window.scrollX;
    const rootPageTop = rect.top + window.scrollY;

    let localX: number;
    let localY: number;

    if (c.coordsType === 'normalized') {
      localX = c.x * rect.width;
      localY = c.y * rect.height;
    } else if (c.coordsType === 'page') {
      // page coordinates are relative to document; subtract root page position
      localX = c.x - rootPageLeft;
      localY = c.y - rootPageTop;
    } else {
      // client coordinates (viewport-relative): subtract root's client rect
      localX = c.x - rect.left;
      localY = c.y - rect.top;
    }

    return { x: localX, y: localY };
  }

  // Update or create cursor
  function upsertCursor(c: CanonicalCursor) {
    if (!c || !c.userId) return;
  const local = canonicalToLocal(c);
    const now = Date.now();
    const key = c.userId;
    let s = cursors.get(key);
    if (!s) {
      s = buildCursorEl(c);
      cursors.set(key, s);
    }
  s.targetX = local.x;
  s.targetY = local.y;
    s.lastSeen = now;
    // update label/avatar/color quickly
    if (c.displayName) s.badge.textContent = c.displayName;
    if (c.color) { s.dot.style.background = c.color; s.avatarEl.style.background = c.color; }
  }

  // Remove cursor (immediate)
  function removeCursor(userId: string) {
    const s = cursors.get(userId);
    if (!s) return;
    try { overlay.removeChild(s.el); } catch (e) {}
    cursors.delete(userId);
  }

  // Throttle inbound processing by timestamp per-user
  const lastProcessed = new Map<string, number>();
  const minInterval = 1000 / options.maxRate; // ms

  // Handle incoming socket events
  const onCursorEvent = (raw: any) => {
    const c = normalizeCursorPayload(raw, options.dev);
    if (!c) return;
    const prev = lastProcessed.get(c.userId) || 0;
    const now = Date.now();
    if (now - prev < minInterval) {
      // accept but don't force heavy updates; update target only
      const existing = cursors.get(c.userId);
      if (existing) {
        const local = canonicalToLocal(c);
        existing.targetX = local.x;
        existing.targetY = local.y;
        existing.lastSeen = now;
      } else {
        upsertCursor(c);
      }
      return;
    }
    lastProcessed.set(c.userId, now);
    upsertCursor(c);
  };

  // Listen to both direct event and wrapped message shapes
  socket.on('cursor_update', onCursorEvent);
  const onMessage = (m: any) => {
    // message may be { type: 'cursor_update', data: {...} }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'cursor_update') onCursorEvent(m.data ?? m.cursor ?? m);
  };
  socket.on('message', onMessage);

  // animation loop
  let rafId: number | null = null;
  function step() {
    rafId = requestAnimationFrame(step);
    const now = Date.now();
    cursors.forEach((s, id) => {
      // remove stale
      if (now - s.lastSeen > options.inactivityTimeout) {
        removeCursor(id);
        return;
      }
      // interpolate
      const dx = s.targetX - s.curX;
      const dy = s.targetY - s.curY;
      s.curX += dx * options.smoothing;
      s.curY += dy * options.smoothing;
      // apply transform
      s.el.style.transform = `translate3d(${Math.round(s.curX)}px, ${Math.round(s.curY)}px, 0)`;
    });
  }
  rafId = requestAnimationFrame(step);

  function destroy() {
    try {
      socket.off('cursor_update', onCursorEvent);
  socket.off('message', onMessage as any);
    } catch (e) {}
    if (rafId) cancelAnimationFrame(rafId);
    try { overlay.remove(); } catch (e) {}
    cursors.clear();
  }

  function toggle(enabled: boolean) {
    overlay.style.display = enabled ? 'block' : 'none';
  }

  function setDev(d: boolean) { options.dev = d; }

  return { destroy, toggle, setDev };
}

export default initRemoteCursors;
