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
      requiresPlan: 'free' as const,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'data_manager' as const,
      name: 'Data Manager',
      icon: FileText,
      requiresPlan: 'free' as const,
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'query_builder' as const,
      name: 'Query Builder',
      icon: Search,
      requiresPlan: 'free' as const,
      color: 'from-purple-500 to-violet-500'
    },
    {
      id: 'relationships' as const,
      name: 'Relationships',
      icon: Link,
      requiresPlan: 'free' as const,
      color: 'from-orange-500 to-red-500'
    },
    {
      id: 'team_collaboration' as const,
      name: 'Team Collaboration',
      icon: Users,
      requiresPlan: 'ultimate' as const,
      color: 'from-pink-500 to-rose-500'
    },
    {
      id: 'sql_validator' as const,
      name: 'SQL Validator',
      icon: AlertTriangle,
      requiresPlan: 'pro' as const,
      color: 'from-yellow-500 to-amber-500'
    },
    {
      id: 'live_sql' as const,
      name: 'Live SQL',
      icon: Code,
      requiresPlan: 'pro' as const,
      color: 'from-indigo-500 to-blue-500'
    },
    {
      id: 'smart_export' as const,
      name: 'Smart Export',
      icon: Download,
      requiresPlan: 'pro' as const,
      color: 'from-teal-500 to-cyan-500'
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
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 transition-all duration-300 ${collapsed ? 'overflow-hidden' : ''}`}>
      
      {/* Horizontal Tabs - Minimal və gözəl */}
      <div className={`border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 ${collapsed ? 'hidden' : ''}`}>
        <div className="flex overflow-x-auto scrollbar-hide px-2 py-1">
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
                  group relative flex items-center gap-3 px-6 py-4 text-sm font-medium whitespace-nowrap 
                  border-b-3 transition-all duration-300 min-w-fit mx-1 rounded-t-xl
                  ${isActive && isAvailable
                    ? `border-transparent bg-gradient-to-r ${tool.color} text-white shadow-lg transform scale-105`
                    : isAvailable
                    ? 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md hover:scale-102'
                    : 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
                  }
                `}
              >
                <div className={`p-2 rounded-lg transition-all duration-300 ${
                  isActive && isAvailable 
                    ? 'bg-white/20 backdrop-blur-sm' 
                    : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{tool.name}</span>
                  {!isAvailable && (
                    <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold">
                      {tool.requiresPlan === 'pro' ? 'Pro' : 'Ultimate'}
                    </span>
                  )}
                </div>
                
                {/* Active indicator */}
                {isActive && isAvailable && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-lg"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool Content - Scrollable və gözəl */}
      <div className={`flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10 ${collapsed ? 'hidden' : ''}`}>
        <div className="p-6">
          {activeTool === 'ddl_builder' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">DDL Builder</h2>
                    <p className="text-blue-100">Create and manage database tables visually</p>
                  </div>
                </div>
              </div>
              <EnhancedTableBuilder />
            </div>
          )}
          
          {activeTool === 'data_manager' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Data Manager</h2>
                    <p className="text-green-100">Manage your table data with CRUD operations</p>
                  </div>
                </div>
              </div>
              <ZeroCodeCRUDBuilder />
            </div>
          )}
          
          {activeTool === 'query_builder' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-500 to-violet-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Query Builder</h2>
                    <p className="text-purple-100">Build complex queries visually</p>
                  </div>
                </div>
              </div>
              <VisualQueryBuilder />
            </div>
          )}
          
          {activeTool === 'relationships' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Link className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Relationships</h2>
                    <p className="text-orange-100">Define connections between tables</p>
                  </div>
                </div>
              </div>
              <RelationshipPanel />
            </div>
          )}
          
          {activeTool === 'team_collaboration' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Team Collaboration</h2>
                    <p className="text-pink-100">Work together in real-time</p>
                  </div>
                </div>
              </div>
              <RealTimeCollaboration />
            </div>
          )}
          
          {activeTool === 'sql_validator' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">SQL Validator</h2>
                    <p className="text-yellow-100">Validate and optimize your schema</p>
                  </div>
                </div>
              </div>
              <SQLAnomalyValidator />
            </div>
          )}
          
          {activeTool === 'live_sql' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Code className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Live SQL Editor</h2>
                    <p className="text-indigo-100">Write and execute SQL in real-time</p>
                  </div>
                </div>
              </div>
              <LiveSQLEditor />
            </div>
          )}
          
          {activeTool === 'smart_export' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Smart Export</h2>
                    <p className="text-teal-100">Export your schema to multiple formats</p>
                  </div>
                </div>
              </div>
              <SmartExportManager />
            </div>
          )}
          
          {!activeTool && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Settings className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-3">Select a Tool</h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose a tool from the tabs above to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapsed State - Vertical Icons */}
      {collapsed && (
        <div className="flex flex-col items-center py-6 space-y-4">
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
                  relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-lg
                  ${isActive && isAvailable
                    ? `bg-gradient-to-r ${tool.color} text-white shadow-xl scale-110`
                    : isAvailable
                    ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:shadow-xl'
                    : 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
                  }
                `}
                title={tool.name}
              >
                <Icon className="w-6 h-6" />
                {isActive && isAvailable && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-current shadow-lg"></div>
                )}
                {!isAvailable && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white dark:border-gray-900 shadow-lg"></div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Plan Status - Gözəl və minimal */}
      <div className={`border-t border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/20 ${collapsed ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Current Plan: <span className="text-blue-600 dark:text-blue-400 capitalize">{currentPlan}</span>
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {tools.filter(t => getToolAvailability(t)).length}/{tools.length} tools available
              </div>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${(tools.filter(t => getToolAvailability(t)).length / tools.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
              {Math.round((tools.filter(t => getToolAvailability(t)).length / tools.length) * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPanel;