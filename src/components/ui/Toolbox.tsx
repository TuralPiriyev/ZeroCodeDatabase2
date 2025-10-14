import React, { useRef } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import useDraggablePosition from '../../hooks/useDraggablePosition';

interface ToolboxProps {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}

const Toolbox: React.FC<ToolboxProps> = ({ id = 'toolbox', children, className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { position, pinned, togglePinned, handlePointerDown, setPosition } = useDraggablePosition({ key: `toolbox:${id}`, defaultPosition: { x: 24, y: 120 }, snapThreshold: 64 });

  return (
    <MotionConfig transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-label="Toolbox"
        tabIndex={0}
        initial={false}
        animate={{ x: position.x, y: position.y, scale: 1, boxShadow: pinned ? '0 6px 20px rgba(0,0,0,0.12)' : '0 10px 30px rgba(0,0,0,0.18)' }}
        className={`fixed w-80 rounded-lg p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50 ${className}`}
        style={{ touchAction: 'none' }}
      >
        <div className="flex items-center gap-2">
          <div
            role="button"
            aria-label="Drag toolbox"
            aria-grabbed={false}
            onPointerDown={(e) => handlePointerDown(e, ref)}
            onKeyDown={(e) => {
              // keyboard nudges
              if (e.key === 'ArrowLeft') setPosition(p => ({ x: Math.max(8, p.x - 8), y: p.y }));
              if (e.key === 'ArrowRight') setPosition(p => ({ x: p.x + 8, y: p.y }));
              if (e.key === 'ArrowUp') setPosition(p => ({ x: p.x, y: Math.max(8, p.y - 8) }));
              if (e.key === 'ArrowDown') setPosition(p => ({ x: p.x, y: p.y + 8 }));
            }}
            className="cursor-grab hover:bg-gray-100 dark:hover:bg-gray-900 p-2 rounded-md"
          >
            <GripVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>

          <div className="flex-1 text-sm font-medium">Tools</div>

          <div className="flex items-center gap-2">
            <button
              className="text-sm px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700"
              onClick={() => togglePinned()}
              aria-pressed={pinned}
              aria-label={pinned ? 'Unpin toolbox' : 'Pin toolbox'}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePinned(); } }}
            >
              {pinned ? 'Pinned' : 'Pin'}
            </button>

            <button
              className="text-sm px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700"
              onClick={() => window.open(`/tools/${id}`, '_blank')}
              aria-label="Pop out toolbox"
            >
              Pop
            </button>
          </div>
        </div>

        <div className="mt-3">
          {children ? children : (
            <div className="text-sm text-gray-600 dark:text-gray-300">No tools selected. Use the top toolbar to open tools.</div>
          )}
        </div>
      </motion.div>
    </MotionConfig>
  );
};

export default Toolbox;
