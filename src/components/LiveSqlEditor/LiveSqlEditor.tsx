import React, { useEffect, useState, useRef } from 'react';
import MonacoEditorWrapper from './editorAdapters/MonacoEditorWrapper';
import useResizableHeight from '../../hooks/useResizableHeight';
import { useDebouncedCallback } from '../../utils/shortcuts';

interface Props {
  initialSql?: string;
  onExecute?: (sql: string) => void;
  onSave?: (sql: string) => void;
}

const STORAGE_KEY = 'live-sql-height';

const LiveSqlEditor: React.FC<Props> = ({ initialSql = '', onExecute, onSave }) => {
  const { height, handleRef } = useResizableHeight(STORAGE_KEY, 480);
  const [sql, setSql] = useState(initialSql);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const editorFocusedRef = useRef(false);

  // Debounced save of sql to localStorage (for drafts) - optional
  const debouncedAutoSave = useDebouncedCallback((value: string) => {
    try { localStorage.setItem('live-sql-draft', value); } catch (e) {}
  }, 500);

  useEffect(() => {
    debouncedAutoSave(sql);
  }, [sql]);

  // keyboard handler for fullscreen toggle via F11
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(s => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // prevent browser save on Ctrl/Cmd+S when editor focused
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && editorFocusedRef.current) {
        e.preventDefault();
        onSave && onSave(sql);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && editorFocusedRef.current) {
        e.preventDefault();
        onExecute && onExecute(sql);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [sql, editorReady]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (editorReady && liveRegionRef.current) {
      liveRegionRef.current.textContent = 'Editor ready';
      const t = setTimeout(() => { if (liveRegionRef.current) liveRegionRef.current.textContent = ''; }, 1200);
      return () => clearTimeout(t);
    }
  }, [editorReady]);

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`} role="application" aria-label="Live SQL editor">
      <div aria-live="polite" ref={liveRegionRef} className="sr-only" />

      {/* Controls - sticky */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 shadow-sm">
        <button onClick={() => onExecute && onExecute(sql)} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm">Execute</button>
        <button onClick={() => onSave && onSave(sql)} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Save</button>
        <button onClick={() => setSql('')} className="px-3 py-2 bg-gray-600 text-white rounded-md text-sm">Reset</button>
        <button onClick={() => {
          const blob = new Blob([sql], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'live_sql.sql'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        }} className="px-3 py-2 bg-purple-600 text-white rounded-md text-sm">Export</button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Font</label>
        </div>

        <button onClick={() => setIsFullscreen(s => !s)} aria-label="Toggle fullscreen" className="ml-2 px-2 py-1 border rounded">{isFullscreen ? 'Exit' : 'Fullscreen'}</button>
      </div>

      {/* Editor area */}
      <div className={`relative ${isFullscreen ? 'h-full' : ''}`} style={{ height: isFullscreen ? '100vh' : `${height}px` }}>
        {isMobile ? (
          <textarea
            className="w-full h-full p-3 bg-white dark:bg-gray-800 border rounded resize-none"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onFocus={() => (editorFocusedRef.current = true)}
            onBlur={() => (editorFocusedRef.current = false)}
          />
        ) : (
          <div className="h-full">
            <MonacoEditorWrapper
              value={sql}
              onChange={(v) => setSql(v)}
              onExecute={() => onExecute && onExecute(sql)}
              onSave={() => onSave && onSave(sql)}
              onReady={() => setEditorReady(true)}
            />
          </div>
        )}

        {/* Drag handle */}
        <div ref={handleRef as any} className="absolute left-0 right-0 bottom-0 h-3 cursor-row-resize bg-transparent" aria-hidden />
      </div>

      {/* Results area (collapsible) */}
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="text-sm text-gray-600">Execution Results will appear here</div>
      </div>

    </div>
  );
};

export default LiveSqlEditor;
