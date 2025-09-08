// src/components/allWorkSpace/layout/MainLayout.tsx
import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import Header from './Header';
import WorkspacePanel from '../panels/WorkspacePanel';
import PortfolioPanel from '../panels/PortfolioPanel';
import ToolsPanel from '../panels/ToolsPanel';
import CollaborativeCursors, { CursorData } from '../workspace/CollaborativeCursors';
import { useDatabase } from '../../../context/DatabaseContext';

const MainLayout: React.FC = () => {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [collaborativeCursors, setCollaborativeCursors] = useState<CursorData[]>([]);
  const [isCollaborationConnected, setIsCollaborationConnected] = useState(false);
  const [cursorUpdateThrottle, setCursorUpdateThrottle] = useState<number>(0);

  const { currentSchema } = useDatabase();

  // Resizing handlers
  const handleLeftResize = (e: React.MouseEvent) => {
    setIsResizingLeft(true);
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(600, startWidth + (e.clientX - startX)));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRightResize = (e: React.MouseEvent) => {
    setIsResizingRight(true);
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(600, startWidth - (e.clientX - startX)));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const handleCollaborationUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;
      
      switch (type) {
        case 'cursor_update':
          // Enhanced cursor validation and deduplication
          if (data && 
              typeof data === 'object' && 
              data.userId && 
              typeof data.userId === 'string' &&
              data.userId.trim().length > 0 &&
              data.username &&
              typeof data.username === 'string' &&
              data.username.trim().length > 0 &&
              data.userId !== 'current_user' &&
              data.username !== 'current_user') { // Never show own cursor
            
            const now = Date.now();
            // Aggressive throttling to prevent duplicate cursors
            if (now - cursorUpdateThrottle < 500) return; // Max 2 updates per second
            setCursorUpdateThrottle(now);
            
            setCollaborativeCursors(prev => {
              // AGGRESSIVE deduplication: remove ALL existing cursors for this user AND username
              let filteredCursors = prev.filter(c => 
                c.userId !== data.userId && 
                c.username !== data.username &&
                c.userId !== 'current_user' &&
                c.username !== 'current_user'
              );
              
              // Additional check: remove any cursor with similar username (case insensitive)
              filteredCursors = filteredCursors.filter(c => 
                c.username.toLowerCase() !== data.username.toLowerCase()
              );
              
              const newCursor = {
                userId: data.userId,
                username: data.username,
                position: data.position || { x: 0, y: 0 },
                color: data.color || '#3B82F6',
                lastSeen: data.lastSeen || new Date().toISOString(),
                selection: data.selection
              };
              
              // Final check to prevent current user cursor
              if (newCursor.userId === 'current_user' || newCursor.username === 'current_user') {
                return filteredCursors;
              }
              
              return [...filteredCursors, newCursor];
            });
          }
          break;
          
        case 'user_left':
          if (data && data.userId) {
            setCollaborativeCursors(prev => prev.filter(c => 
              c.userId !== data.userId && c.username !== data.username
            ));
          }
          break;
          
        case 'connection_status':
          setIsCollaborationConnected(data.connected);
          // Clear all cursors when disconnected
          if (!data.connected) {
            setCollaborativeCursors([]);
          }
          break;
          
        default:
          break;
      }
    };

    window.addEventListener('collaboration-event', handleCollaborationUpdate as EventListener);

    return () => {
      window.removeEventListener('collaboration-event', handleCollaborationUpdate as EventListener);
    };
  }, [currentSchema?.id, cursorUpdateThrottle]);

  // Panel toggles
  const toggleLeftPanel = () => setLeftPanelOpen(p => !p);
  const toggleRightPanel = () => setRightPanelOpen(p => !p);
  const toggleLeftCollapse = () => setLeftPanelCollapsed(p => !p);
  const toggleRightCollapse = () => setRightPanelCollapsed(p => !p);

  // Enhanced cursor move handling with better throttling
  const handleCursorMove = (pos: { x: number; y: number; tableId?: string; columnId?: string }) => {
    // Strict validation and throttling
    if (isCollaborationConnected && 
        pos && 
        typeof pos.x === 'number' && 
        typeof pos.y === 'number' &&
        pos.x >= 0 && pos.y >= 0) {
      
      // Throttle cursor broadcasts
      const now = Date.now();
      if (now - cursorUpdateThrottle < 100) return;
      setCursorUpdateThrottle(now);
      
      window.dispatchEvent(new CustomEvent('cursor-move', {
        detail: { position: pos }
      }));
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
      <Header />
      
      {/* Collaboration Status Indicator - Only show in development */}
      {import.meta.env.DEV && (
        <div className="fixed top-20 right-4 z-50">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isCollaborationConnected 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
          }`}>
            {isCollaborationConnected ? '🟢 Collaboration Active' : '🟡 Collaboration Offline'}
          </div>
        </div>
      )}
      
      {/* Collaborative Cursors Overlay */}
      <CollaborativeCursors 
        cursors={collaborativeCursors}
        onCursorMove={handleCursorMove}
      />
      
      <div className="flex-1 flex relative">
        {/* Mobile Menu Buttons */}
        <div className="lg:hidden absolute top-4 left-4 z-50">
          <button
            onClick={toggleLeftPanel}
            className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-105"
            aria-label={leftPanelOpen ? "Close tools panel" : "Open tools panel"}
          >
            {leftPanelOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        <div className="lg:hidden absolute top-4 right-4 z-50">
          <button
            onClick={toggleRightPanel}
            className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-105"
            aria-label={rightPanelOpen ? "Close portfolio panel" : "Open portfolio panel"}
          >
            {rightPanelOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Left Panel - Advanced Tools */}
        <div className={`
          fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out shadow-xl
          lg:relative lg:translate-x-0 lg:shadow-none
          ${leftPanelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${leftPanelCollapsed ? 'lg:w-12' : 'w-80'}
        `} style={{ width: leftPanelCollapsed ? '48px' : `${leftPanelWidth}px` }}>
          
          {/* Resize Handle */}
          {!leftPanelCollapsed && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-500 transition-colors duration-200 group z-50"
              onMouseDown={handleLeftResize}
            >
              <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg">
                  <GripVertical className="w-3 h-3" />
                </div>
              </div>
            </div>
          )}
          
          {/* Collapse Toggle Button */}
          <div className="hidden lg:block absolute top-4 -right-3 z-50">
            <button
              onClick={toggleLeftCollapse}
              className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
              aria-label={leftPanelCollapsed ? "Expand tools panel" : "Collapse tools panel"}
            >
              {leftPanelCollapsed ? (
                <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
          
          <div className="lg:hidden absolute top-4 right-4">
            <button
              onClick={() => setLeftPanelOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
              aria-label="Close tools panel"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          {/* Tools Panel Content */}
          <ToolsPanel collapsed={leftPanelCollapsed} />
        </div>

        {/* Center Panel - Workspace */}
        <div className="flex-1 lg:w-3/5">
          <WorkspacePanel />
        </div>

        {/* Right Panel - Portfolio & Chat */}
        <div className={`
          fixed inset-y-0 right-0 z-40 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out shadow-xl
          lg:relative lg:translate-x-0 lg:shadow-none
          ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          ${rightPanelCollapsed ? 'lg:w-12' : 'w-80'}
        `} style={{ width: rightPanelCollapsed ? '48px' : `${rightPanelWidth}px` }}>
          
          {/* Resize Handle */}
          {!rightPanelCollapsed && (
            <div
              className="absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-500 transition-colors duration-200 group z-50"
              onMouseDown={handleRightResize}
            >
              <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg">
                  <GripVertical className="w-3 h-3" />
                </div>
              </div>
            </div>
          )}
          
          {/* Collapse Toggle Button */}
          <div className="hidden lg:block absolute top-4 -left-3 z-50">
            <button
              onClick={toggleRightCollapse}
              className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
              aria-label={rightPanelCollapsed ? "Expand portfolio panel" : "Collapse portfolio panel"}
            >
              {rightPanelCollapsed ? (
                <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
          
          <div className="lg:hidden absolute top-4 left-4">
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
              aria-label="Close portfolio panel"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <PortfolioPanel collapsed={rightPanelCollapsed} />
        </div>

        {/* Mobile Overlays */}
        {(leftPanelOpen || rightPanelOpen) && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 backdrop-blur-sm"
            onClick={() => {
              setLeftPanelOpen(false);
              setRightPanelOpen(false);
            }}
          />
        )}
      </div>
      
      {/* Resizing overlay */}
      {(isResizingLeft || isResizingRight) && (
        <div className="fixed inset-0 z-50 cursor-col-resize bg-black bg-opacity-10" />
      )}
    </div>
  );
};

export default MainLayout;