import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface TopToolbarProps {
  pinnedTools: string[];
  onSelect: (toolId: string) => void;
}

const TopToolbar: React.FC<TopToolbarProps> = ({ pinnedTools, onSelect }) => {
  if (!pinnedTools || pinnedTools.length === 0) return null;
  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-full mx-auto px-4 py-2 flex items-center gap-3 overflow-x-auto scrollbar-hide">
        {pinnedTools.map(id => (
          <button
            key={id}
            draggable
            onDragStart={(e) => { e.dataTransfer?.setData('text/plain', id); e.dataTransfer?.setData('tool-id', id); }}
            onClick={() => onSelect(id)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-sm rounded-md shadow-sm hover:shadow-md"
          >
            <span className="font-medium">{id.replace('_', ' ').toUpperCase()}</span>
            <ArrowUpRight className="w-4 h-4 text-gray-600" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopToolbar;
