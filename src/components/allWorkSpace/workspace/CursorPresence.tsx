import React, { useEffect, useRef, useState } from 'react';
import { simpleWebSocketService } from '../../../services/simpleWebSocketService';
import { useAuth } from '../../../context/AuthContext';

interface CursorData {
  userId: string;
  username: string;
  color?: string;
  position: { x: number; y: number };
  lastSeen: string;
}

const CursorPresence: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const { getCurrentUser } = useAuth();
  const user = getCurrentUser();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});

  // throttle emits to ~50ms
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;

    const ensureConnected = async () => {
      try {
        await simpleWebSocketService.connect();
        simpleWebSocketService.joinWorkspace(workspaceId);
        // announce presence
        try {
          if (user) simpleWebSocketService.send('user_join', { userId: user.id, username: user.username, workspaceId });
        } catch (e) {}
      } catch (e) {
        // ignore
      }
    };

    ensureConnected();

    const onCursor = (data: any) => {
      if (!mounted || !data) return;
      // server may wrap cursor inside { cursor } or send directly
      const payload = data.cursor ? data.cursor : data;
      if (!payload || !payload.userId) return;
      // convert coords to numbers
      const x = Number(payload.position?.x || 0);
      const y = Number(payload.position?.y || 0);
      setCursors(prev => ({ ...(prev || {}), [payload.userId]: { userId: payload.userId, username: payload.username || payload.userId, color: payload.color || '#7c3aed', position: { x, y }, lastSeen: payload.lastSeen || new Date().toISOString() } }));
    };

    const onUserLeft = (data: any) => {
      if (!mounted || !data) return;
      const uid = data.userId || data.username || data;
      if (!uid) return;
      setCursors(prev => {
        const copy = { ...prev };
        delete copy[uid];
        return copy;
      });
    };

    simpleWebSocketService.on('cursor_update', onCursor);
    simpleWebSocketService.on('user_left', onUserLeft);
    simpleWebSocketService.on('user_joined', (d: any) => {
      // optional: initialize entry
      if (!d || !d.userId) return;
      setCursors(prev => ({ ...(prev || {}), [d.userId]: prev?.[d.userId] || { userId: d.userId, username: d.username || d.userId, color: d.color || '#7c3aed', position: { x: 0, y: 0 }, lastSeen: new Date().toISOString() } }));
    });

    return () => {
      mounted = false;
      try { simpleWebSocketService.off('cursor_update', onCursor); } catch (e) {}
      try { simpleWebSocketService.off('user_left', onUserLeft); } catch (e) {}
      try { simpleWebSocketService.send('user_leave', { userId: user?.id, username: user?.username, workspaceId }); } catch (e) {}
    };
  }, [workspaceId, user]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (ev: MouseEvent) => {
      if (!user) return;
      const now = Date.now();
      if (now - lastEmitRef.current < 50) return; // throttle
      lastEmitRef.current = now;

      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));

      try {
        simpleWebSocketService.send('cursor_update', {
          cursor: {
            userId: user.id,
            username: user.username,
            position: { x: Math.round(x), y: Math.round(y) },
            color: (user as any).color || undefined,
            lastSeen: new Date().toISOString()
          }
        });
      } catch (e) {
        // ignore
      }
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', () => {
      if (!user) return;
      try { simpleWebSocketService.send('user_leave', { userId: user.id, username: user.username, workspaceId }); } catch (e) {}
    });

    return () => {
      el.removeEventListener('mousemove', onMove);
    };
  }, [user, workspaceId]);

  return (
    // overlay container should be positioned by parent; we'll use absolute positioning inside
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60 }}>
      {Object.values(cursors).map(c => {
        // don't render local user's cursor label (optional)
        if (!c || !c.position) return null;
        const isLocal = user && c.userId === user.id;
        const left = c.position.x;
        const top = c.position.y;
        return (
          <div key={c.userId} style={{ position: 'absolute', transform: 'translate(-50%, -100%)', left, top, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 6, background: c.color || '#7c3aed', boxShadow: '0 0 6px rgba(0,0,0,0.15)' }} />
              {!isLocal && (
                <div style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {c.username}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CursorPresence;
