import React, { useEffect, useState } from 'react';
import { MousePointer } from 'lucide-react';

export interface CursorData {
  userId: string;
  username: string;
  position: { x: number; y: number };
  color: string;
  selection?: {
    tableId: string;
    columnId?: string;
  };
  lastSeen: string;
}

interface CollaborativeCursorsProps {
  cursors: CursorData[];
  onCursorMove?: (position: { x: number; y: number }) => void;
}

const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({ 
  cursors, 
  onCursorMove 
}) => {
  const [visibleCursors, setVisibleCursors] = useState<CursorData[]>([]);
  const [lastCursorUpdate, setLastCursorUpdate] = useState<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Throttle cursor updates to prevent spam
      const now = Date.now();
      if (now - lastCursorUpdate > 100) { // Max 10 updates per second
        const newPosition = { x: e.clientX, y: e.clientY };
        onCursorMove?.(newPosition);
        setLastCursorUpdate(now);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [onCursorMove, lastCursorUpdate]);

  // Enhanced cursor filtering and deduplication
  useEffect(() => {
    const now = Date.now();
    const tenSecondsAgo = now - 10000; // 10 seconds timeout for better visibility
    
    // Aggressive deduplication - prevent ALL duplicate cursors
    const cursorMap = new Map<string, CursorData>();
    
    cursors.forEach(cursor => {
      // Skip invalid cursors and current user
      if (!cursor.userId || !cursor.username || 
          cursor.userId === 'current_user' || 
          cursor.username === 'current_user' ||
          cursor.userId.trim() === '' ||
          cursor.username.trim() === '') {
        return;
      }
      
      const lastSeenTime = new Date(cursor.lastSeen).getTime();
      
      // Only show recent cursors
      if (lastSeenTime > tenSecondsAgo) {
        const existing = cursorMap.get(cursor.userId);
        
        // Keep ONLY the most recent cursor for each user
        if (!existing || lastSeenTime > new Date(existing.lastSeen).getTime()) {
          cursorMap.set(cursor.userId, {
            ...cursor,
            // Ensure position is valid
            position: {
              x: Math.max(0, Math.min(cursor.position.x, window.innerWidth)),
              y: Math.max(0, Math.min(cursor.position.y, window.innerHeight))
            }
          });
        }
      }
    });
    
    // Final check: remove any cursors that might be duplicates by username
    const finalCursors = Array.from(cursorMap.values());
    const uniqueByUsername = new Map<string, CursorData>();
    
    finalCursors.forEach(cursor => {
      const existing = uniqueByUsername.get(cursor.username);
      if (!existing || new Date(cursor.lastSeen).getTime() > new Date(existing.lastSeen).getTime()) {
        uniqueByUsername.set(cursor.username, cursor);
      }
    });
    
    setVisibleCursors(Array.from(uniqueByUsername.values()));
  }, [cursors]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {visibleCursors.map(cursor => (
        <div
          key={cursor.userId}
          className="absolute transition-all duration-150 ease-out pointer-events-none"
          style={{
            left: cursor.position.x,
            top: cursor.position.y,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor Icon */}
          <div className="relative">
            <MousePointer 
              className="w-5 h-5 drop-shadow-lg"
              style={{ color: cursor.color }}
            />
            
            {/* Username Label - Always visible with better styling */}
            <div 
              className="absolute top-6 left-2 px-3 py-1 rounded-lg text-xs font-bold text-white shadow-xl whitespace-nowrap backdrop-blur-sm border border-white/20"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.username}
            </div>

            {/* Subtle pulse animation - reduced opacity to prevent visual noise */}
            <div 
              className="absolute w-2 h-2 rounded-full animate-ping opacity-10"
              style={{ 
                backgroundColor: cursor.color,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CollaborativeCursors;
export type { CursorData };