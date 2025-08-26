import React from 'react';
import { X, Copy, Download } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';

interface SQLPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQLPreviewModal: React.FC<SQLPreviewModalProps> = ({ isOpen, onClose }) => {
  const { generateSQL, currentSchema } = useDatabase();

  if (!isOpen) return null;

  const sqlScript = generateSQL();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
  };

  const downloadScript = () => {
    const blob = new Blob([sqlScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSchema.name.toLowerCase().replace(/\s+/g, '_')}_schema.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Generated SQL Script - {currentSchema.name}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={downloadScript}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-900 dark:text-gray-100 overflow-auto">
            {sqlScript}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SQLPreviewModal;