/*
remote-cursors.js
Vanilla JS remote cursor overlay module.
Exports a global `RemoteCursors` object when loaded via <script>.

API:
 - RemoteCursors.attachRemoteCursorToSocket(socket, { eventName = 'cursor_update', workspaceSelector = 'body', idleMs = 5000, dev = false })
 - RemoteCursors.attachRemoteCursorToWindowEvents(eventName, { workspaceSelector, idleMs, dev })
 - RemoteCursors.removeRemoteCursor(userId)
 - RemoteCursors.debugRemoteCursors(enable)

Usage: include this file and the companion remote-cursors.css, then call attachRemoteCursorToSocket with your socket instance.

This file is framework-free and small. It defends against HTML injection for labels and accepts several payload shapes.
*/
(function (global) {
  'use strict';

  // ======= Configuration defaults =======
  var DEFAULT_EVENT = 'cursor_update';
  var DEFAULT_IDLE_MS = 5000; // 5s
  var SMOOTHING = 0.18; // lerp factor
  var DEBUG = false;

  // ======= Utilities =======
  function safeText(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function now() { return Date.now(); }

  // Deterministic color from id (returns hsl string)
  function colorFromId(id) {
    var str = String(id || 'uid');
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) % 360;
    }
    // nice pastel saturation/lightness
    return 'hsl(' + (h) + ', 70%, 50%)';
  }

  // Try to parse payload: accept object, JSON string, wrapper {type,data} etc.
  function parsePayload(raw) {
    if (!raw && raw !== 0) return null;
    try {
      if (typeof raw === 'string') {
        // try JSON parse, otherwise treat as text
        try { raw = JSON.parse(raw); } catch (e) { return { raw: raw }; }
      }

      // unwrap common wrappers
      if (raw && typeof raw === 'object') {
        if (raw.data && typeof raw.data === 'object') raw = raw.data;
        else if (raw.payload && typeof raw.payload === 'object') raw = raw.payload;
        else if (raw.message && typeof raw.message === 'object') raw = raw.message;
      }

      return raw;
    } catch (e) {
      return null;
    }
  }

  // Accept many coordinate shapes and return { x, y, type }
  // supports: x,y | clientX/clientY | pageX/pageY | nx,ny (normalized 0..1)
  function extractCoords(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var nx = firstOf(obj, ['nx', 'normalizedX', 'normalized_x']);
    var ny = firstOf(obj, ['ny', 'normalizedY', 'normalized_y']);
    if (isNumber(nx) && isNumber(ny)) return { x: nx, y: ny, type: 'normalized' };

    var x = firstOf(obj, ['x', 'clientX', 'pageX']);
    var y = firstOf(obj, ['y', 'clientY', 'pageY']);
    if (isNumber(x) && isNumber(y)) return { x: Number(x), y: Number(y), type: 'px' };

    // sometimes position: {x,y}
    if (obj.position && typeof obj.position === 'object') {
      return extractCoords(obj.position);
    }

    return null;
  }

  function firstOf(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  }

  function isNumber(n) { return n !== null && n !== undefined && !isNaN(Number(n)); }

  // ======= Overlay / DOM management =======
  var overlay = null;
  var statusEl = null;
  var cursors = {}; // userId -> state
  var rafId = null;
  var workspaceEl = null; // element used for normalized mapping
  var idleMs = DEFAULT_IDLE_MS;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rc-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999999';
    overlay.setAttribute('data-rc-overlay','1');

    statusEl = document.createElement('div');
    statusEl.className = 'rc-status';
    statusEl.setAttribute('data-rc-status','1');
    statusEl.style.position = 'absolute';
    statusEl.style.right = '8px';
    statusEl.style.bottom = '8px';
    statusEl.style.pointerEvents = 'none';
    statusEl.style.fontSize = '12px';
    statusEl.style.color = '#fff';
    statusEl.style.background = 'rgba(0,0,0,0.6)';
    statusEl.style.padding = '6px 8px';
    statusEl.style.borderRadius = '8px';
    statusEl.textContent = 'cursors: 0';
    overlay.appendChild(statusEl);

    document.body.appendChild(overlay);
    return overlay;
  }

  function updateStatus() {
    if (!statusEl) return;
    var count = Object.keys(cursors).length;
    statusEl.textContent = 'cursors: ' + count;
  }

  function createCursorEl(userId, displayName, color) {
    var el = document.createElement('div');
    el.className = 'rc-cursor';
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.transform = 'translate3d(-9999px,-9999px,0)';
    el.style.willChange = 'transform, opacity';
    el.setAttribute('data-rc-user', String(userId));

    var dot = document.createElement('div');
    dot.className = 'rc-dot';
    dot.style.background = color || colorFromId(userId);
    dot.style.width = '12px';
    dot.style.height = '12px';
    dot.style.borderRadius = '50%';
    dot.style.position = 'absolute';
    dot.style.left = '0';
    dot.style.top = '0';
    dot.style.transform = 'translate(-50%,-50%)';
    dot.style.boxShadow = '0 0 8px rgba(0,0,0,0.25)';

    var badge = document.createElement('div');
    badge.className = 'rc-badge';
    badge.innerHTML = safeText(displayName || userId);

    el.appendChild(dot);
    el.appendChild(badge);

    if (DEBUG) el.classList.add('rc-debug');

    ensureOverlay().appendChild(el);
    return { el: el, dot: dot, badge: badge };
  }

  function removeCursorEl(userId) {
    var s = cursors[userId];
    if (!s) return;
    try { s.el.parentNode && s.el.parentNode.removeChild(s.el); } catch (e) {}
    delete cursors[userId];
    updateStatus();
  }

  // Smooth step loop
  function step() {
    rafId = requestAnimationFrame(step);
    var nowTs = now();
    for (var id in cursors) {
      if (!cursors.hasOwnProperty(id)) continue;
      var s = cursors[id];
      // remove stale
      if (nowTs - s.lastSeen > idleMs) {
        // fade and remove
        s.el.style.opacity = String(Math.max(0, 1 - ((nowTs - s.lastSeen - idleMs) / 400)));
        // actually remove when well past
        if (nowTs - s.lastSeen > idleMs + 400) removeCursorEl(id);
        continue;
      }
      // lerp
      var dx = s.targetX - s.curX;
      var dy = s.targetY - s.curY;
      s.curX += dx * SMOOTHING;
      s.curY += dy * SMOOTHING;
      s.el.style.transform = 'translate3d(' + Math.round(s.curX) + 'px,' + Math.round(s.curY) + 'px,0)';
    }
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(step);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Map canonical coords to viewport client coords
  function mapToViewport(coords) {
    // coords: { x, y, type }
    var rect = (workspaceEl && workspaceEl.getBoundingClientRect && workspaceEl.getBoundingClientRect()) || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    if (coords.type === 'normalized') {
      var cx = rect.left + coords.x * rect.width;
      var cy = rect.top + coords.y * rect.height;
      return { x: cx, y: cy };
    }
    // px: assume client coordinates (viewport)
    return { x: coords.x, y: coords.y };
  }

  // Normalize raw payload to { userId, id, name, color, coords }
  function normalize(raw) {
    var p = parsePayload(raw);
    if (!p) return null;

    // Accept either id or userId
    var userId = p.userId || p.user || p.id || p.uid || (p.user && (p.user.id || p.user.userId));
    if (!userId && p.id) userId = p.id;
    if (!userId) return null;

    var displayName = p.name || p.displayName || (p.user && (p.user.name || p.user.username)) || String(userId);
    var color = p.color || (p.user && p.user.color) || colorFromId(userId);

    var coords = extractCoords(p);
    if (!coords) return null;

    return { userId: String(userId), id: p.id || null, name: displayName, color: color, coords: coords };
  }

  // Public API functions
  function attachRemoteCursorToSocket(socket, opts) {
    opts = opts || {};
    var eventName = opts.eventName || DEFAULT_EVENT;
    var sel = opts.workspaceSelector || 'body';
    idleMs = (typeof opts.idleMs === 'number') ? opts.idleMs : DEFAULT_IDLE_MS;
    if (opts.dev) debugRemoteCursors(true);

    // resolve workspace element
    try { workspaceEl = document.querySelector(sel) || document.body; } catch (e) { workspaceEl = document.body; }

    ensureOverlay();
    startLoop();

    if (!socket || typeof socket.on !== 'function') {
      // try plain EventTarget style (window-like)
      if (socket && typeof socket.addEventListener === 'function') {
        socket.addEventListener(eventName, onMessageFromSocket);
      } else {
        throw new Error('socket must provide .on/.off or addEventListener');
      }
    } else {
      socket.on(eventName, onMessageFromSocket);
    }

    function detach() {
      try {
        if (socket && typeof socket.off === 'function') socket.off(eventName, onMessageFromSocket);
        if (socket && typeof socket.removeEventListener === 'function') socket.removeEventListener(eventName, onMessageFromSocket);
      } catch (e) {}
    }

    return { detach: detach };
  }

  function onMessageFromSocket(raw) {
    if (DEBUG) console.debug('[RemoteCursors] raw payload:', raw);
    var n = normalize(raw);
    if (!n) return;
    var vp = mapToViewport(n.coords);
    upsert(n.userId, n.name, n.color, vp.x, vp.y);
    if (DEBUG) console.debug('[RemoteCursors] normalized:', n, 'viewport:', vp);
  }

  function attachRemoteCursorToWindowEvents(eventName, opts) {
    opts = opts || {};
    var sel = opts.workspaceSelector || 'body';
    idleMs = (typeof opts.idleMs === 'number') ? opts.idleMs : DEFAULT_IDLE_MS;
    if (opts.dev) debugRemoteCursors(true);
    try { workspaceEl = document.querySelector(sel) || document.body; } catch (e) { workspaceEl = document.body; }

    ensureOverlay();
    startLoop();
    window.addEventListener(eventName, function (ev) {
      var raw = ev && ev.detail ? ev.detail : ev;
      onMessageFromSocket(raw);
    });
    return { detach: function () { window.removeEventListener(eventName, onMessageFromSocket); } };
  }

  function upsert(userId, name, color, x, y) {
    if (!userId) return;
    var s = cursors[userId];
    if (!s) {
      var elObj = createCursorEl(userId, name, color);
      s = {
        el: elObj.el,
        dot: elObj.dot,
        badge: elObj.badge,
        curX: x,
        curY: y,
        targetX: x,
        targetY: y,
        lastSeen: now()
      };
      cursors[userId] = s;
      updateStatus();
    } else {
      s.targetX = x;
      s.targetY = y;
      s.lastSeen = now();
      // update label/color quickly
      if (name) s.badge.innerHTML = safeText(name);
      if (color) s.dot.style.background = color;
    }
  }

  function removeRemoteCursor(userId) {
    removeCursorEl(userId);
  }

  function debugRemoteCursors(enable) {
    DEBUG = !!enable;
    if (overlay) {
      try {
        Object.keys(cursors).forEach(function (id) {
          var s = cursors[id];
          if (s && s.el) {
            if (DEBUG) s.el.classList.add('rc-debug'); else s.el.classList.remove('rc-debug');
          }
        });
      } catch (e) {}
    }
    return DEBUG;
  }

  // Expose small global API
  var API = {
    attachRemoteCursorToSocket: attachRemoteCursorToSocket,
    attachRemoteCursorToWindowEvents: attachRemoteCursorToWindowEvents,
    removeRemoteCursor: removeRemoteCursor,
    debugRemoteCursors: debugRemoteCursors
  };

  // attach to window
  global.RemoteCursors = API;

  // auto-start loop when script loaded so callers can attach later
  // loop will start when first cursor attached; for safety, keep not running now

})(window);
