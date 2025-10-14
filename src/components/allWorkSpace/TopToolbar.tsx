import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Code } from 'lucide-react';

interface TopToolbarProps {
  active?: string | null;
  onSelect: (toolId: string) => void;
}

const TOOL_ORDER = [
  { id: 'ddl_builder', label: 'DDL Builder' },
  { id: 'data_manager', label: 'Data Manager' },
  { id: 'query_builder', label: 'Query Builder' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'team_collaboration', label: 'Team Collaboration' },
  { id: 'sql_validator', label: 'SQL Validator' },
  { id: 'live_sql', label: 'Live SQL' },
  { id: 'smart_export', label: 'Smart Export' }
];

const TopToolbar: React.FC<TopToolbarProps> = ({ active = null, onSelect }) => {
  const emit = (action: string) => {
    try {
      window.dispatchEvent(new CustomEvent('workspace-control', { detail: { action } }));
    } catch (e) { console.warn('emit workspace-control failed', e); }
  };

  return (
    <div className="w-full bg-gradient-to-r from-white to-blue-50 dark:from-gray-900 dark:to-blue-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto scrollbar-hide">
        <div className="flex-1 flex justify-center gap-2">
          {TOOL_ORDER.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${active === t.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'bg-white/60 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:shadow-sm border border-gray-100 dark:border-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => emit('zoom-out')} className="p-2 rounded-md bg-white/60 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
            <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </button>
          <button onClick={() => emit('reset-view')} className="p-2 rounded-md bg-white/60 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
            <RotateCcw className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </button>
          <button onClick={() => emit('zoom-in')} className="p-2 rounded-md bg-white/60 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm">
            <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </button>
          <button onClick={() => emit('show-sql')} className="ml-2 px-3 py-2 rounded-md bg-white/60 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-sm text-sm flex items-center gap-2">
            <Code className="w-4 h-4 text-gray-700 dark:text-gray-200" /> Show SQL
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopToolbar;
