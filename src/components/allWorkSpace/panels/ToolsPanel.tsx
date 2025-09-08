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
      
      {/* Horizontal Tabs - Navbar-dan uzaq və kiçik */}
      <div className={`mt-4 mx-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-t-lg ${collapsed ? 'hidden' : ''}`}>
        <div className="flex overflow-x-auto scrollbar-hide px-1 py-1">
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
                  group relative flex items-center gap-2 px-3 py-2 text-xs font-medium whitespace-nowrap 
                  border-b-2 transition-all duration-300 min-w-fit mx-0.5 rounded-t-lg
                  ${isActive && isAvailable
                    ? `border-transparent bg-gradient-to-r ${tool.color} text-white shadow-md transform scale-102`
                    : isAvailable
                    ? 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm hover:scale-101'
                    : 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
                  }
                `}
              >
                <div className={`p-1.5 rounded-md transition-all duration-300 ${
                  isActive && isAvailable 
                    ? 'bg-white/20 backdrop-blur-sm' 
                    : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-medium text-xs">{tool.name}</span>
                  {!isAvailable && (
                    <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-medium">
                      {tool.requiresPlan === 'pro' ? 'Pro' : 'Ultimate'}
                    </span>
                  )}
                </div>
                
                {/* Active indicator */}
                {isActive && isAvailable && (
                  <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-md"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool Content - Scrollable və kompakt */}
      <div className={`flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10 ${collapsed ? 'hidden' : ''}`}>
        <div className="p-4">
          {activeTool === 'ddl_builder' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">DDL Builder</h2>
                    <p className="text-blue-100 text-sm">Create and manage database tables visually</p>
                  </div>
                </div>
              </div>
              <EnhancedTableBuilder />
            </div>
          )}
          
          {activeTool === 'data_manager' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Data Manager</h2>
                    <p className="text-green-100 text-sm">Manage your table data with CRUD operations</p>
                  </div>
                </div>
              </div>
              <ZeroCodeCRUDBuilder />
            </div>
          )}
          
          {activeTool === 'query_builder' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-500 to-violet-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Query Builder</h2>
                    <p className="text-purple-100 text-sm">Build complex queries visually</p>
                  </div>
                </div>
              </div>
              <VisualQueryBuilder />
            </div>
          )}
          
          {activeTool === 'relationships' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Link className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Relationships</h2>
                    <p className="text-orange-100 text-sm">Define connections between tables</p>
                  </div>
                </div>
              </div>
              <RelationshipPanel />
            </div>
          )}
          
          {activeTool === 'team_collaboration' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Team Collaboration</h2>
                    <p className="text-pink-100 text-sm">Work together in real-time</p>
                  </div>
                </div>
              </div>
              <RealTimeCollaboration />
            </div>
          )}
          
          {activeTool === 'sql_validator' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">SQL Validator</h2>
                    <p className="text-yellow-100 text-sm">Validate and optimize your schema</p>
                  </div>
                </div>
              </div>
              <SQLAnomalyValidator />
            </div>
          )}
          
          {activeTool === 'live_sql' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Code className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Live SQL Editor</h2>
                    <p className="text-indigo-100 text-sm">Write and execute SQL in real-time</p>
                  </div>
                </div>
              </div>
              <LiveSQLEditor />
            </div>
          )}
          
          {activeTool === 'smart_export' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Smart Export</h2>
                    <p className="text-teal-100 text-sm">Export your schema to multiple formats</p>
                  </div>
                </div>
              </div>
              <SmartExportManager />
            </div>
          )}
          
          {!activeTool && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Settings className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">Select a Tool</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Choose a tool from the tabs above to get started
                </p>
              </div>
            </div>
          )}
        </div>
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
                  relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-md
                  ${isActive && isAvailable
                    ? `bg-gradient-to-r ${tool.color} text-white shadow-lg scale-105`
                    : isAvailable
                    ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
                  }
                `}
                title={tool.name}
              >
                <Icon className="w-5 h-5" />
                {isActive && isAvailable && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full border-2 border-current shadow-md"></div>
                )}
                {!isAvailable && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white dark:border-gray-900 shadow-md"></div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Plan Status - Kompakt və minimal */}
      <div className={`border-t border-gray-200 dark:border-gray-700 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/20 ${collapsed ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-md flex items-center justify-center shadow-md">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Current Plan: <span className="text-blue-600 dark:text-blue-400 capitalize">{currentPlan}</span>
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-xs">
                {tools.filter(t => getToolAvailability(t)).length}/{tools.length} tools available
              </div>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${(tools.filter(t => getToolAvailability(t)).length / tools.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {Math.round((tools.filter(t => getToolAvailability(t)).length / tools.length) * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPanel;