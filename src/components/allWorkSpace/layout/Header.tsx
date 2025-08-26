import React from 'react';
import { Moon, Sun, Database } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import PlanBadge from '../../subscription/PlanBadge' // Added subscription plan badge

const Header: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-sky-100 dark:bg-sky-900 rounded-lg">
          <Database className="w-6 h-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Database Creator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visual database design workspace
          </p>
        </div>
      </div>

      {/* Added plan badge and theme toggle */}
      <div className="flex items-center gap-3">
        <PlanBadge />
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-105"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-yellow-500" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;