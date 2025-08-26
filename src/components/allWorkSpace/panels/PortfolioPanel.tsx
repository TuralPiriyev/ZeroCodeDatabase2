import React, { useState } from 'react';
import { ArrowRight, MessageSquare, Bot } from 'lucide-react';
import PortfolioManager from '../portfolio/PortfolioManager';
import MultilingualChatInterface from '../chat/MultilingualChatInterface';

interface PortfolioPanelProps {
  collapsed?: boolean;
}

const PortfolioPanel: React.FC<PortfolioPanelProps> = ({ collapsed = false }) => {
  const [activeSection, setActiveSection] = useState<'portfolio' | 'ai'>('portfolio');

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 pt-16 lg:pt-0 transition-all duration-300 overflow-y-auto ${collapsed ? 'overflow-hidden' : ''}`}>
      {/* Section Tabs */}
      <div className={`border-b border-gray-200 dark:border-gray-700 ${collapsed ? 'hidden' : ''}`}>
        <nav className="flex" aria-label="Portfolio sections">
          <button
            onClick={() => setActiveSection('portfolio')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200
              ${activeSection === 'portfolio'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
            aria-pressed={activeSection === 'portfolio'}
          >
            <ArrowRight className="w-4 h-4" />
            Portfolio
          </button>
          
          <button
            onClick={() => setActiveSection('ai')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200
              ${activeSection === 'ai'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
            aria-pressed={activeSection === 'ai'}
          >
            <Bot className="w-4 h-4" />
            AI Assistant
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-hidden ${collapsed ? 'hidden' : ''}`}>
        {activeSection === 'portfolio' && <PortfolioManager />}
        {activeSection === 'ai' && <MultilingualChatInterface />}
      </div>
      
      {/* Collapsed State - Show only icons */}
      {collapsed && (
        <div className="flex flex-col items-center py-4 space-y-3">
          <button
            onClick={() => setActiveSection('portfolio')}
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
              ${activeSection === 'portfolio'
                ? 'bg-sky-100 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }
            `}
            title="Portfolio"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActiveSection('ai')}
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
              ${activeSection === 'ai'
                ? 'bg-sky-100 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }
            `}
            title="AI Assistant"
          >
            <Bot className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PortfolioPanel;