import React, { useState } from 'react';
import { 
  Database, Search, Link, Users, Code, Download, 
  Settings, AlertTriangle, FileText, Activity 
} from 'lucide-react';
import { useSubscription } from '../../../context/SubscriptionContext';
import EnhancedTableBuilder from '../tools/EnhancedTableBuilder';
import RelationshipPanel from '../tools/RelationshipPanel';
import SQLAnomalyValidator from '../tools/SQLAnomalyValidator';
import LiveSQLEditor from '../tools/LiveSQLEditor';
import SmartExportManager from '../tools/SmartExportManager';
import RealTimeCollaboration from '../tools/RealTimeCollaboration';
import VisualQueryBuilder from '../tools/VisualQueryBuilder';
import ZeroCodeCRUDBuilder from '../tools/ZeroCodeCRUDBuilder';

type ActiveTool = 
  | 'ddl_builder' 
  | 'data_manager' 
  | 'query_builder' 
  | 'relationships' 
  | 'team_collaboration'
  | 'sql_validator' 
  | 'live_sql' 
  | 'smart_export'
  | null;

interface ToolsPanelProps {
  collapsed?: boolean;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ collapsed = false }) => {
  const { currentPlan } = useSubscription();
  const [activeTool, setActiveTool] = useState<ActiveTool>('ddl_builder');

  const tools = [
    {
      id: 'ddl_builder' as const,
      name: 'DDL Builder',
      icon: Database,
      requiresPlan: 'free' as const
    },
    {
      id: 'data_manager' as const,
      name: 'Data Manager',
      icon: FileText,
      requiresPlan: 'free' as const
    },
    {
      id: 'query_builder' as const,
      name: 'Query Builder',
      icon: Search,
      requiresPlan: 'free' as const
    },
    {
      id: 'relationships' as const,
      name: 'Relationships',
      icon: Link,
      requiresPlan: 'free' as const
    },
    {
      id: 'team_collaboration' as const,
      name: 'Team Collaboration',
      icon: Users,
      requiresPlan: 'ultimate' as const
    },
    {
      id: 'sql_validator' as const,
      name: 'SQL Validator',
      icon: AlertTriangle,
      requiresPlan: 'pro' as const
    },
    {
      id: 'live_sql' as const,
      name: 'Live SQL',
      icon: Code,
      requiresPlan: 'pro' as const
    },
    {
      id: 'smart_export' as const,
      name: 'Smart Export',
      icon: Download,
      requiresPlan: 'pro' as const
    }
  ];

  const getToolAvailability = (tool: typeof tools[0]) => {
    switch (tool.requiresPlan) {
      case 'free':
        return true;
      case 'pro':
        return currentPlan === 'pro' || currentPlan === 'ultimate';
      case 'ultimate':
        return currentPlan === 'ultimate';
      default:
        return false;
    }
  };

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 pt-16 lg:pt-0 transition-all duration-300 ${collapsed ? 'overflow-hidden' : ''}`}>
      
      {/* Horizontal Tabs - Şəkildəki kimi */}
      <div className={`border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${collapsed ? 'hidden' : ''}`}>
        <div className="flex overflow-x-auto scrollbar-hide">
          {tools.map(tool => {
            const Icon = tool.icon;
            const isAvailable = getToolAvailability(tool);
            const isActive = activeTool === tool.id;
            
            return (
              <button
                key={tool.id}
                onClick={() => isAvailable && setActiveTool(tool.id)}
                disabled={!isAvailable}
                className={`
                  flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 min-w-fit
                  ${isActive && isAvailable
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900'
                    : isAvailable
                    ? 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tool.name}</span>
                {!isAvailable && (
                  <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full ml-1">
                    {tool.requiresPlan === 'pro' ? 'Pro' : 'Ultimate'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool Content - Scrollable */}
      <div className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 ${collapsed ? 'hidden' : ''}`}>
        {activeTool === 'ddl_builder' && <EnhancedTableBuilder />}
        {activeTool === 'data_manager' && <ZeroCodeCRUDBuilder />}
        {activeTool === 'query_builder' && <VisualQueryBuilder />}
        {activeTool === 'relationships' && <RelationshipPanel />}
        {activeTool === 'team_collaboration' && <RealTimeCollaboration />}
        {activeTool === 'sql_validator' && <SQLAnomalyValidator />}
        {activeTool === 'live_sql' && <LiveSQLEditor />}
        {activeTool === 'smart_export' && <SmartExportManager />}
        
        {!activeTool && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Select a Tool</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Choose a tool from the tabs above to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Collapsed State - Vertical Icons */}
      {collapsed && (
        <div className="flex flex-col items-center py-4 space-y-3">
          {tools.slice(0, 6).map(tool => {
            const Icon = tool.icon;
            const isAvailable = getToolAvailability(tool);
            const isActive = activeTool === tool.id;
            
            return (
              <button
                key={tool.id}
                onClick={() => isAvailable && setActiveTool(tool.id)}
                disabled={!isAvailable}
                className={`
                  relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110
                  ${isActive && isAvailable
                    ? 'bg-blue-500 text-white shadow-lg'
                    : isAvailable
                    ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                    : 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
                  }
                `}
                title={tool.name}
              >
                <Icon className="w-5 h-5" />
                {isActive && isAvailable && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                )}
                {!isAvailable && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Plan Status - Minimal */}
      <div className={`border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800 ${collapsed ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">
              Plan: <span className="font-medium text-blue-600 dark:text-blue-400 capitalize">{currentPlan}</span>
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {tools.filter(t => getToolAvailability(t)).length}/{tools.length} tools
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPanel;