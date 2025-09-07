import React, { useState } from 'react';
import { 
  Database, Search, Link, Users, Code, Download, 
  Settings, AlertTriangle, FileText, Activity 
} from 'lucide-react';
import { useSubscription } from '../../../context/SubscriptionContext'; // Added subscription context
import EnhancedTableBuilder from '../tools/EnhancedTableBuilder';
import RelationshipPanel from '../tools/RelationshipPanel';
import SQLAnomalyValidator from '../tools/SQLAnomalyValidator';
import LiveSQLEditor from '../tools/LiveSQLEditor';
import SmartExportManager from '../tools/SmartExportManager';
import RealTimeCollaboration from '../tools/RealTimeCollaboration';
import VisualQueryBuilder from '../tools/VisualQueryBuilder';
import ZeroCodeCRUDBuilder from '../tools/ZeroCodeCRUDBuilder';

type ActiveTool = 
  | 'enhanced_table' 
  | 'relationships' 
  | 'sql_validator' 
  | 'live_sql' 
  | 'smart_export' 
  | 'collaboration'
  | 'query_builder'
  | 'crud_builder'
  | null;

interface ToolsPanelProps {
  collapsed?: boolean;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ collapsed = false }) => {
  const { currentPlan } = useSubscription(); // Added subscription hook
  const [activeTool, setActiveTool] = useState<ActiveTool>('enhanced_table');

  const tools = [
    {
      id: 'enhanced_table' as const,
      name: 'Advanced Tables',
      icon: Database,
      description: 'Create tables with FK validation',
      category: 'Schema Design',
      requiresPlan: 'free' as const
    },
    {
      id: 'relationships' as const,
      name: 'Relationships',
      icon: Link,
      description: 'Manage table relationships',
      category: 'Schema Design',
      requiresPlan: 'free' as const
    },
    {
      id: 'query_builder' as const,
      name: 'Query Builder',
      icon: Search,
      description: 'Visual query construction',
      category: 'Data Management',
      requiresPlan: 'free' as const
    },
    {
      id: 'crud_builder' as const,
      name: 'Data Manager',
      icon: FileText,
      description: 'CRUD operations',
      category: 'Data Management',
      requiresPlan: 'free' as const
    },
    {
      id: 'sql_validator' as const,
      name: 'SQL Validator',
      icon: AlertTriangle,
      description: 'Schema validation & audit',
      category: 'Validation',
      requiresPlan: 'pro' as const
    },
    {
      id: 'live_sql' as const,
      name: 'Live SQL',
      icon: Code,
      description: 'Real-time SQL editor',
      category: 'Development',
      requiresPlan: 'pro' as const
    },
    {
      id: 'smart_export' as const,
      name: 'Smart Export',
      icon: Download,
      description: 'Advanced export options',
      category: 'Import/Export',
      requiresPlan: 'pro' as const
    },
    {
      id: 'collaboration' as const,
      name: 'Collaboration',
      icon: Users,
      description: 'Real-time team features',
      category: 'Collaboration',
      requiresPlan: 'ultimate' as const
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

  // Group tools by category
  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, typeof tools>);

  const categoryConfig = {
    'Schema Design': { icon: Database, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
    'Data Management': { icon: FileText, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20' },
    'Validation': { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' },
    'Development': { icon: Code, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
    'Import/Export': { icon: Download, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20' },
    'Collaboration': { icon: Users, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-900/20' }
  };

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 pt-16 lg:pt-0 transition-all duration-300 overflow-y-auto ${collapsed ? 'overflow-hidden' : ''}`}>
      {/* Tool Categories & Selection */}
      <div className={`border-b border-gray-200 dark:border-gray-700 ${collapsed ? 'hidden' : ''}`}>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Advanced Tools
          </h3>
          
          {/* Beautiful Tool Categories Grid */}
          <div className="space-y-6">
            {Object.entries(toolsByCategory).map(([categoryName, categoryTools]) => {
              const config = categoryConfig[categoryName as keyof typeof categoryConfig];
              const CategoryIcon = config?.icon || Database;
              const categoryColor = config?.color || 'text-gray-600 dark:text-gray-400';
              const categoryBgColor = config?.bgColor || 'bg-gray-50 dark:bg-gray-900/20';
              
              return (
                <div key={categoryName} className="space-y-3">
                  {/* Category Header */}
                  <div className={`flex items-center gap-3 p-3 rounded-xl ${categoryBgColor} border border-gray-200 dark:border-gray-700`}>
                    <div className={`w-8 h-8 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm`}>
                      <CategoryIcon className={`w-4 h-4 ${categoryColor}`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm ${categoryColor}`}>{categoryName}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{categoryTools.length} tools available</p>
                    </div>
                  </div>
                  
                  {/* Tools Grid - 2 columns for better layout */}
                  <div className="grid grid-cols-2 gap-3">
                    {categoryTools.map(tool => {
                      const Icon = tool.icon;
                      const isAvailable = getToolAvailability(tool);
                      const isActive = activeTool === tool.id;
                      
                      return (
                        <button
                          key={tool.id}
                          onClick={() => isAvailable && setActiveTool(tool.id)}
                          disabled={!isAvailable}
                          className={`
                            group relative flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all duration-300 transform hover:scale-105
                            ${isActive && isAvailable
                              ? 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/30 dark:to-blue-900/30 border-2 border-sky-400 shadow-lg shadow-sky-200 dark:shadow-sky-900/50'
                              : isAvailable
                              ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm hover:shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed border-2 border-gray-200 dark:border-gray-600'
                            }
                          `}
                        >
                          {/* Tool Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            isActive && isAvailable
                              ? 'bg-sky-500 text-white shadow-lg'
                              : isAvailable
                              ? 'bg-gray-100 dark:bg-gray-600 group-hover:bg-gray-200 dark:group-hover:bg-gray-500'
                              : 'bg-gray-200 dark:bg-gray-600'
                          }`}>
                            <Icon className={`w-5 h-5 ${
                              isActive && isAvailable 
                                ? 'text-white' 
                                : isAvailable 
                                ? 'text-gray-600 dark:text-gray-300' 
                                : 'text-gray-400'
                            }`} />
                          </div>
                          
                          {/* Tool Name */}
                          <div className="min-w-0 w-full">
                            <h5 className={`font-semibold text-xs leading-tight mb-1 ${
                              isActive && isAvailable
                                ? 'text-sky-700 dark:text-sky-300'
                                : isAvailable
                                ? 'text-gray-800 dark:text-gray-200'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {tool.name}
                            </h5>
                            
                            {/* Plan Badge */}
                            {!isAvailable && (
                              <span className="inline-block text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-1 rounded-full font-medium shadow-sm">
                                {tool.requiresPlan === 'pro' ? 'Pro' : 'Ultimate'}
                              </span>
                            )}
                            
                            {/* Active Indicator */}
                            {isActive && isAvailable && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-sky-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"></div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Tool Content */}
      <div className={`flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900/50 ${collapsed ? 'hidden' : ''}`}>
        {activeTool === 'enhanced_table' && <EnhancedTableBuilder />}
        {activeTool === 'relationships' && <RelationshipPanel />}
        {activeTool === 'query_builder' && <VisualQueryBuilder />}
        {activeTool === 'crud_builder' && <ZeroCodeCRUDBuilder />}
        {activeTool === 'sql_validator' && <SQLAnomalyValidator />}
        {activeTool === 'live_sql' && <LiveSQLEditor />}
        {activeTool === 'smart_export' && <SmartExportManager />}
        {activeTool === 'collaboration' && <RealTimeCollaboration />}
        
        {!activeTool && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Settings className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Select a Tool</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-48">
                Select a tool to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Collapsed State - Show only icons */}
      {collapsed && (
        <div className="flex flex-col items-center py-4 space-y-4">
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
                  relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 transform hover:scale-110
                  ${isActive && isAvailable
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-200 dark:shadow-sky-900/50'
                    : isAvailable
                    ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                    : 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
                  }
                `}
                title={tool.name}
              >
                <Icon className="w-5 h-5" />
                {isActive && isAvailable && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-sky-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                )}
                {!isAvailable && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Plan Status */}
      <div className={`border-t border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 ${collapsed ? 'hidden' : ''}`}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Current Plan: <span className="text-blue-600 dark:text-blue-400 capitalize">{currentPlan}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {tools.filter(t => getToolAvailability(t)).length} of {tools.length} tools available
                </div>
              </div>
            </div>
            
            {/* Plan Progress Bar */}
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(tools.filter(t => getToolAvailability(t)).length / tools.length) * 100}%` 
                  }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {Math.round((tools.filter(t => getToolAvailability(t)).length / tools.length) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPanel;