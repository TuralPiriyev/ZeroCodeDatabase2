import React, { useState, useCallback, useEffect } from 'react';
import DatabaseCanvas from '../workspace/DatabaseCanvas';
import SQLPreviewModal from '../workspace/SQLPreviewModal';

const WorkspacePanel: React.FC = () => {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showSQLModal, setShowSQLModal] = useState(false);

    // Helper component to listen to global workspace control events
    const WorkspaceEventListener: React.FC<{ onShowSQL: () => void; onReset: () => void }> = ({ onShowSQL, onReset }) => {
      useEffect(() => {
        const handler = (e: Event) => {
          const ev: any = e as any;
          if (!ev || !ev.detail || !ev.detail.action) return;
          const a = ev.detail.action;
          if (a === 'show-sql') onShowSQL();
          else if (a === 'zoom-in') setZoom(prev => Math.min(prev + 25, 200));
          else if (a === 'zoom-out') setZoom(prev => Math.max(prev - 25, 25));
          else if (a === 'reset-view') onReset();
        };
        window.addEventListener('workspace-control', handler as EventListener);
        return () => window.removeEventListener('workspace-control', handler as EventListener);
      }, [onShowSQL, onReset]);
      return null;
    };

  const handleResetView = useCallback(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, []);

  // Canvas-dan zoom dəyişikliklərini qəbul etmək üçün callback
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.round(newZoom));
  }, []);

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      {/* Listen to workspace-control events from TopToolbar */}
  <WorkspaceEventListener onShowSQL={() => setShowSQLModal(true)} onReset={() => handleResetView()} />

      {/* Canvas */}
      <DatabaseCanvas 
        zoom={zoom} 
        pan={pan} 
        onPanChange={setPan}
        onZoomChange={handleZoomChange}
      />

      {/* SQL Preview Modal */}
      <SQLPreviewModal 
        isOpen={showSQLModal} 
        onClose={() => setShowSQLModal(false)} 
      />
    </div>
  );
};

export default WorkspacePanel;