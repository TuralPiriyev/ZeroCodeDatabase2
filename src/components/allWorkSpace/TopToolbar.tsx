import React from 'react';
import { } from 'lucide-react';

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
  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-full mx-auto px-4 py-2 flex items-center gap-3 overflow-x-auto scrollbar-hide justify-center">
        {TOOL_ORDER.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${active === t.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:shadow-sm'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopToolbar;
