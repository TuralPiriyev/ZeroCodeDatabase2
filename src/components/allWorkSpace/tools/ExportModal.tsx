import React from 'react';
import { X, Download, FileText, Database } from 'lucide-react';

interface ExportOptions {
  includeData: boolean;
  includeIndexes: boolean;
  includeConstraints: boolean;
  includeComments: boolean;
  formatOutput: boolean;
  targetVersion?: string;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: string, options: ExportOptions) => void;
  selectedFormat: string;
  exportOptions: ExportOptions;
  setExportOptions: (options: ExportOptions) => void;
  projectName: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  selectedFormat,
  exportOptions,
  setExportOptions,
  projectName
}) => {
  if (!isOpen) return null;

  const formatDetails = {
    mysql: { name: 'MySQL', icon: '🐬', ext: 'sql' },
    postgresql: { name: 'PostgreSQL', icon: '🐘', ext: 'sql' },
    sqlserver: { name: 'SQL Server', icon: '🏢', ext: 'sql' },
    oracle: { name: 'Oracle', icon: '🔴', ext: 'sql' },
    mongodb: { name: 'MongoDB', icon: '🍃', ext: 'js' },
    json: { name: 'JSON Schema', icon: '📄', ext: 'json' },
    csv: { name: 'CSV Data', icon: '📊', ext: 'csv' },
    typescript: { name: 'TypeScript', icon: '📘', ext: 'ts' },
    prisma: { name: 'Prisma Schema', icon: '⚡', ext: 'prisma' }
  };

  const currentFormat = formatDetails[selectedFormat as keyof typeof formatDetails];
  const filename = `${projectName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${currentFormat?.ext || 'sql'}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export Schema
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure your export settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Format Info */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                Export Format
              </h4>
              
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{currentFormat?.icon}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {currentFormat?.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      .{currentFormat?.ext} file
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FileText className="w-4 h-4" />
                    <span className="font-mono">{filename}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">Export Preview</span>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedFormat === 'csv' && 'Tabular data with table and column information'}
                  {selectedFormat === 'json' && 'Structured schema data in JSON format'}
                  {selectedFormat.includes('sql') && 'Complete SQL DDL statements for database creation'}
                  {selectedFormat === 'typescript' && 'TypeScript interface definitions'}
                  {selectedFormat === 'prisma' && 'Prisma ORM schema file'}
                  {selectedFormat === 'mongodb' && 'MongoDB collection schema definitions'}
                </div>
              </div>
            </div>

            {/* Right Column - Export Options */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                Export Options
              </h4>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeData}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeData: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Include Sample Data</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Export existing table data</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeIndexes}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeIndexes: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Include Indexes</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Export database indexes</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeConstraints}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeConstraints: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Include Constraints</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Export table constraints</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeComments}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeComments: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Include Comments</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Add descriptive comments</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.formatOutput}
                    onChange={(e) => setExportOptions({ ...exportOptions, formatOutput: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Format Output</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Pretty-print the output</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Export will be saved as: <span className="font-mono">{filename}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(selectedFormat, exportOptions)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium"
            >
              <Download className="w-4 h-4" />
              Export {currentFormat?.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;