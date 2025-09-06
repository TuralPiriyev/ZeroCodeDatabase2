import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function CollaborativeCursors({ workspaceId, token }: { workspaceId: string; token?: string }) {
  const { connect, joinWorkspace, on, off } = useWebSocket(token);
  const [cursors, setCursors] = useState<any>({});

  useEffect(() => { connect(); joinWorkspace(workspaceId); }, [workspaceId]);

  useEffect(() => {
    const handler = (data: any) => {
      if (!data || !data.cursor) return;
      setCursors((prev: any) => ({ ...prev, [data.cursor.userId]: data.cursor }));
    };
    on('cursor_update', handler);
    return () => { off('cursor_update', handler); };
  }, []);

  return (
    <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0 }}>
      {Object.values(cursors).map((c: any) => (
        <div key={c.userId} style={{ position: 'absolute', left: c.position?.x || 0, top: c.position?.y || 0, background: c.color || 'red', padding: '2px 6px', borderRadius: 4 }}>
          {c.username}
        </div>
      ))}
    </div>
  );
}
