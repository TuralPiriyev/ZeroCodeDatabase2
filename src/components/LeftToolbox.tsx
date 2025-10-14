import React, { useCallback, useState } from 'react';
import { Database, FileText, Search, Link, Users, AlertTriangle, Code, Download } from 'lucide-react';
import ToolPanel from './ToolPanel';

type ToolDef = { id: string; title: string; icon: any };

const TOOLS: ToolDef[] = [
  { id: 'ddl_builder', title: 'DDL Builder', icon: Database },
  { id: 'data_manager', title: 'Data Manager', icon: FileText },
  { id: 'query_builder', title: 'Query Builder', icon: Search },
  { id: 'relationships', title: 'Relationships', icon: Link },
  { id: 'team_collaboration', title: 'Team Collaboration', icon: Users },
  { id: 'sql_validator', title: 'SQL Validator', icon: AlertTriangle },
  { id: 'live_sql', title: 'Live SQL', icon: Code },
  { id: 'smart_export', title: 'Smart Export', icon: Download },
];

const LeftToolbox: React.FC = () => {
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});

  const togglePanel = useCallback((id: string) => {
    setOpenPanels(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const closePanel = useCallback((id: string) => {
    setOpenPanels(prev => ({ ...prev, [id]: false }));
  }, []);

  return (
    <div className="w-20 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 space-y-3">
      {TOOLS.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => togglePanel(t.id)} className="flex flex-col items-center gap-1 focus:outline-none" title={t.title}>
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
              <Icon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t.title.split(' ')[0]}</span>
          </button>
        );
      })}

      {/* Render panels */}
      {Object.entries(openPanels).map(([id, open]) => open ? (
        <ToolPanel key={id} id={id} title={TOOLS.find(t => t.id === id)?.title || id} onClose={() => closePanel(id)} />
      ) : null)}
    </div>
  );
};

export default LeftToolbox;
