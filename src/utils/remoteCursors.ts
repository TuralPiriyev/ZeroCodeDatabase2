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
  .rc-cursor { position: absolute; pointer-events: none; transform: translate3d(0,0,0); will-change: transform, opacity; display:flex; align-items:center; gap:8px; }
  .rc-dot { width:12px;height:12px;border-radius:50%;box-shadow:0 0 8px rgba(0,0,0,0.25);transform:translate(-50%,-50%); flex:0 0 auto; }
  /* pointer is absolutely positioned so its tip can align with the coordinate (0,0) */
  .rc-pointer { width:24px; height:32px; position:absolute; left:0; top:0; transform-origin: 0 0; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25)); pointer-events:none; }
  .rc-pointer svg { width:100%; height:100%; display:block; }
  .rc-pointer { z-index: 1000001; }
  .rc-badge { display:inline-block; background: rgba(0,0,0,0.75); color: #fff; padding:6px 10px; border-radius:10px; font-size:12px; margin-top:0; white-space:nowrap; flex:0 0 auto; }
  .rc-avatar { width:22px;height:22px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-weight:600;color:#fff;font-size:12px;margin-right:6px; flex:0 0 auto; }
  .rc-wrapper { display:flex; align-items:center; gap:6px; }
  .rc-hidden { opacity:0; pointer-events:none; }
  .rc-overlay { pointer-events: none; }
  .rc-cursor, .rc-badge, .rc-dot { z-index: 1000000; }
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

  // extract identifiers (accept string or numeric ids and username/name fallbacks)
  let userId: any = source.userId ?? source.uid ?? source.id ?? source.user?.id ?? source.userId ?? source.username ?? source.name ?? source.user?.username;
  if (userId === undefined || userId === null) continue;

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

  // normalize userId to string for deterministic keys
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

  // container overlay: mount on document.body as fixed so it's never clipped by workspace transforms
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '999999';
  overlay.className = 'rc-overlay';
  overlay.setAttribute('data-rc-overlay', '1');
  document.body.appendChild(overlay);

  // visible status badge to help debug if cursors are tracked
  const status = document.createElement('div');
  status.style.position = 'absolute';
  status.style.right = '8px';
  status.style.bottom = '8px';
  status.style.padding = '6px 8px';
  status.style.background = 'rgba(0,0,0,0.6)';
  status.style.color = '#fff';
  status.style.borderRadius = '8px';
  status.style.fontSize = '12px';
  status.style.pointerEvents = 'none';
  status.textContent = 'cursors: 0';
  status.setAttribute('data-rc-status', '1');
  overlay.appendChild(status);

  type CursorState = {
    el: HTMLElement;
    dot: HTMLElement; // pointer element (kept named `dot` for compatibility)
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
    wrapper.setAttribute('data-rc-cursor', c.userId);
    wrapper.style.left = '0px';
    wrapper.style.top = '0px';
    wrapper.style.position = 'absolute';
    wrapper.style.transform = 'translate3d(-9999px,-9999px,0)';

    const inner = document.createElement('div');
    inner.className = 'rc-wrapper';

    // avatar (image or initials)
    const avatar = document.createElement('div');
    avatar.className = 'rc-avatar';
    if (c.avatar) {
      const img = document.createElement('img');
      img.src = c.avatar;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.onerror = () => { avatar.textContent = initials(c.displayName || c.userId); };
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(c.displayName || c.userId);
    }

    const badge = document.createElement('div');
    badge.className = 'rc-badge';
    badge.textContent = c.displayName || c.userId;

    // create a mouse-pointer shaped SVG element (use dot property name for compatibility)
    const pointer = document.createElement('div');
    pointer.className = 'rc-pointer';
    // arrow-like mouse pointer SVG (tip at 0,0)
    pointer.innerHTML = `
      <svg viewBox="0 0 24 32" width="24" height="32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="currentColor" d="M1 1 L1 27 L8 20 L12 30 L14 28 L10 18 L20 10 L1 1 Z" />
      </svg>
    `;
    // tint via currentColor
    (pointer.style as any).color = c.color || '#111827';
    // ensure the pointer's origin (tip) is at 0,0 so the wrapper translate places the tip correctly
    pointer.style.transform = 'translate(0px,0px)';

  inner.appendChild(avatar);
  inner.appendChild(badge);
  // offset the badge/avatar so they don't overlap the absolutely-positioned pointer
  inner.style.marginLeft = '30px';

    wrapper.appendChild(pointer);
    wrapper.appendChild(inner);

    // compute initial viewport (client) coordinates for the cursor using root mapping
    const vp = canonicalToViewport(c);
    wrapper.style.transform = `translate3d(${Math.round(vp.x)}px, ${Math.round(vp.y)}px, 0)`;

    const state: CursorState = {
      el: wrapper,
      dot: pointer as any,
      badge,
      avatarEl: avatar,
      targetX: vp.x,
      targetY: vp.y,
      curX: vp.x,
      curY: vp.y,
      lastSeen: Date.now(),
      color: c.color
    };

    if (options.dev) console.debug('[RemoteCursors] buildCursorEl appended for', c.userId, 'at', Math.round(vp.x), Math.round(vp.y));

    overlay.appendChild(wrapper);
    return state;
  }

  function initials(name: string) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0,2);
    return parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0,2);
  }

  // Convert canonical cursor coords to viewport (client) coordinates relative to the document
  // This maps normalized coords using the workspace root bounding rect and leaves client coords intact.
  function canonicalToViewport(c: CanonicalCursor) {
    const rect = root.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if (c.coordsType === 'normalized') {
      clientX = rect.left + c.x * rect.width;
      clientY = rect.top + c.y * rect.height;
    } else if (c.coordsType === 'page') {
      // page coords -> convert to client by removing page scroll
      clientX = c.x - window.scrollX;
      clientY = c.y - window.scrollY;
    } else {
      // client coords are usually viewport-relative, but some payloads send coordinates
      // relative to the workspace root (small numbers). Heuristic: if x/y fit inside
      // the root bounding box, treat them as root-local and map into viewport.
      if (typeof c.x === 'number' && typeof c.y === 'number' && c.x >= 0 && c.y >= 0 && c.x <= rect.width && c.y <= rect.height) {
        clientX = rect.left + c.x;
        clientY = rect.top + c.y;
      } else {
        clientX = c.x;
        clientY = c.y;
      }
    }
    return { x: clientX, y: clientY };
  }

  // Update or create cursor
  function upsertCursor(c: CanonicalCursor) {
    if (!c || !c.userId) return;
  const local = canonicalToViewport(c);
    const now = Date.now();
    const key = c.userId;
    let s = cursors.get(key);
    if (!s) {
        s = buildCursorEl(c);
        cursors.set(key, s);
    // update status
    status.textContent = `cursors: ${cursors.size}`;
    if (options.dev) console.debug('[RemoteCursors] created cursor for', key, 'initial target', s.targetX, s.targetY);
    }
  s.targetX = local.x;
  s.targetY = local.y;
    s.lastSeen = now;
    // update label/avatar/color quickly
    if (c.displayName) s.badge.textContent = c.displayName;
    if (c.color) {
      try { (s.dot as HTMLElement).style.color = c.color; } catch (e) {}
      try { s.avatarEl.style.background = c.color; } catch (e) {}
    }
      if (options.dev) console.debug('[RemoteCursors] upsertCursor updated', key, 'target =>', Math.round(s.targetX), Math.round(s.targetY));
  }

  // Remove cursor (immediate)
  function removeCursor(userId: string) {
    const s = cursors.get(userId);
    if (!s) return;
    try { overlay.removeChild(s.el); } catch (e) {}
    cursors.delete(userId);
  status.textContent = `cursors: ${cursors.size}`;
  if (options.dev) console.debug('[RemoteCursors] removed cursor for', userId);
  }

  // Throttle inbound processing by timestamp per-user
  const lastProcessed = new Map<string, number>();
  const minInterval = 1000 / options.maxRate; // ms

  // Handle incoming socket events
  const onCursorEvent = (raw: any) => {
  let c: CanonicalCursor | null = normalizeCursorPayload(raw, options.dev);
    if (!c) {
      // tolerant fallback: try to find any nested object that looks like a cursor payload
      const fb = tolerantExtract(raw);
      if (fb) {
        c = fb;
        if (options.dev) console.debug('[RemoteCursors] onCursorEvent used fallback normalized:', c, 'from raw:', raw);
      } else {
        if (options.dev) console.debug('[RemoteCursors] onCursorEvent ignored payload (no coords found):', raw);
        return;
      }
    }
  // c is CanonicalCursor here
  if (options.dev) console.debug('[RemoteCursors] onCursorEvent normalized:', c);
  const prev = lastProcessed.get(c.userId) || 0;
    const now = Date.now();
    if (now - prev < minInterval) {
      // accept but don't force heavy updates; update target only
      const existing = cursors.get(c.userId);
      if (existing) {
        const local = canonicalToViewport(c);
        if (options.dev) console.debug('[RemoteCursors] mapped viewport coords (throttle):', local);
        existing.targetX = local.x;
        existing.targetY = local.y;
        existing.lastSeen = now;
      } else {
        upsertCursor(c);
      }
      return;
    }
    lastProcessed.set(c.userId, now);
    // log mapped coords then upsert
    if (options.dev) console.debug('[RemoteCursors] mapped viewport coords:', canonicalToViewport(c));
    upsertCursor(c);
  };

  // Tolerant recursive extractor: scan nested objects for something that normalizes to a cursor
  function tolerantExtract(obj: any): CanonicalCursor | null {
    try {
      if (!obj || typeof obj !== 'object') return null;
      // quick candidate check
      const maybe = normalizeCursorPayload(obj, false);
      if (maybe) return maybe;
      // recurse into values
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object') {
          const found = tolerantExtract(v);
          if (found) {
            if (options.dev) console.debug('[RemoteCursors] tolerantExtract found nested candidate for', Object.keys(obj || {}));
            return found;
          }
        }
      }
      return null;
    } catch (e) { return null; }
  }

  // Listen to both direct event and wrapped message shapes
  socket.on('cursor_update', onCursorEvent);
  const onMessage = (m: any) => {
    // message may be { type: 'cursor_update', data: {...} }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'cursor_update') onCursorEvent(m.data ?? m.cursor ?? m);
  };
  socket.on('message', onMessage);

  // additional dev logging: subscribe to a set of common events and print concise info
  const devHandlers: Array<{ evt: string; h: (d: any) => void }> = [];
  if (options.dev) {
    ['cursor_update', 'message', 'db_update', 'user_joined', 'user_left'].forEach(evt => {
      const h = (d: any) => {
        try {
          console.info('[RemoteCursors] evt', evt, Object.keys(d || {}).length ? (d.type ? d.type : Object.keys(d).slice(0,6)) : d);
        } catch (e) { console.info('[RemoteCursors] evt', evt); }
      };
      socket.on(evt, h);
      devHandlers.push({ evt, h });
    });
  }

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
      // remove dev handlers
      try {
        if (devHandlers.length) devHandlers.forEach(dh => socket.off(dh.evt, dh.h));
      } catch (e) {}
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
