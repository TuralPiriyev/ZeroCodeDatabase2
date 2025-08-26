import React, { useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Move, RotateCcw, Code } from 'lucide-react';
import DatabaseCanvas from '../workspace/DatabaseCanvas';
import SQLPreviewModal from '../workspace/SQLPreviewModal';

const WorkspacePanel: React.FC = () => {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showSQLModal, setShowSQLModal] = useState(false);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 25));
  }, []);

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
      {/* Controls */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        {/* SQL Preview Button */}
        <button
          onClick={() => setShowSQLModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg transition-colors duration-200 text-sm"
        >
          <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">Show SQL</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
            aria-label="Zoom out"
            disabled={zoom <= 25}
          >
            <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          
          <span className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-16 text-center">
            {zoom}%
          </span>
          
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
            aria-label="Zoom in"
            disabled={zoom >= 200}
          >
            <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          
          <div className="w-px bg-gray-200 dark:bg-gray-600 mx-1" />
          
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
            aria-label="Reset view"
          >
            <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

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