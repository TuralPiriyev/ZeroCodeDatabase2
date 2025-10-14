import React, { memo, useEffect } from 'react';
import { Pin, X, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import useDraggablePanel from '../hooks/useDraggablePanel';
import MultiWindowSync from '../utils/multiWindowSync';

export interface ToolPanelProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  initial?: { x: number; y: number };
  onClose?: () => void;
  children?: React.ReactNode;
}

const sync = new MultiWindowSync();

const ToolPanel: React.FC<ToolPanelProps> = ({ id, title, icon: Icon, initial = { x: 120, y: 120 }, children, onClose }) => {
  const { pos, setPos, pinned, togglePinned, close, open, onPointerDown } = useDraggablePanel(id, { x: initial.x, y: initial.y, pinned: false });

  useEffect(() => {
    const unsub = sync.onMessage((m) => {
      if (m.type === 'STATE_UPDATE' && m.panelId === id && m.state) {
        setPos({ x: m.state.x, y: m.state.y });
      }
    });
    return unsub;
  }, [id, setPos]);

  if (!open) return null;

  return (
    <motion.div
      role="dialog"
      aria-label={`${title} panel`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="fixed z-50 bg-white dark:bg-gray-800 border rounded shadow-xl"
      style={{ left: pos.x, top: pos.y, width: 360, touchAction: 'none' }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2 border-b dark:border-gray-700 cursor-grab select-none"
        onPointerDown={(e) => onPointerDown(e, e.currentTarget.parentElement as HTMLElement)}
        aria-grabbed={false}
        aria-describedby={`${id}-help`}
      >
        {Icon ? <Icon className="w-5 h-5 text-gray-600" /> : null}
        <div className="flex-1 text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          <button onClick={togglePinned} aria-label={`Toggle pin ${title}`} className="p-1 rounded hover:bg-gray-100">
            <Pin className={`w-4 h-4 ${pinned ? 'text-yellow-500' : 'text-gray-500'}`} />
          </button>
          <button onClick={() => {
            // detach: open in new window and close here
            const w = window.open(`/tools/${id}?popout=1`, '_blank', 'width=800,height=600');
            if (w) {
              sync.post({ type: 'INIT', panelId: id, state: { x: pos.x, y: pos.y } });
              // let the other window request state
            }
          }} aria-label={`Detach ${title}`} className="p-1 rounded hover:bg-gray-100">
            <ArrowUpRight className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => { close(); onClose && onClose(); sync.post({ type: 'CLOSE', panelId: id }); }} aria-label={`Close ${title}`} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      <div id={`${id}-help`} className="sr-only">Drag header to move the panel. Press enter/space to activate buttons.</div>
      <div className="p-3 max-h-[60vh] overflow-auto">
        {children || <div className="text-sm text-gray-600">No content for {title}</div>}
      </div>
    </motion.div>
  );
};

export default memo(ToolPanel);
