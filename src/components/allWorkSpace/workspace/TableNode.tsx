import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, Link2, Trash2, MoreVertical, Database, Edit, Plus, Copy } from 'lucide-react';
import { Table } from '../../../context/DatabaseContext';
import { useDatabase } from '../../../context/DatabaseContext';

interface TableNodeProps {
  data: Table;
  selected?: boolean;
}

const TableNode: React.FC<TableNodeProps> = memo(({ data, selected }) => {
  const { removeTable, insertRow, duplicateTable, currentSchema } = useDatabase();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});

  const handleDeleteTable = () => {
    removeTable(data.id);
    setShowDeleteConfirm(false);
    setShowMenu(false);
  };

  const handleAddRow = () => {
    // Initialize form data with default values
    const initialData: Record<string, any> = {};
    data.columns.forEach(column => {
      initialData[column.name] = column.defaultValue || '';
    });
    setNewRowData(initialData);
    setShowAddRowModal(true);
    setShowMenu(false);
  };

  const handleSaveNewRow = () => {
    insertRow(data.id, newRowData);
    setShowAddRowModal(false);
    setNewRowData({});
  };

  const handleEditTable = () => {
    // This will be implemented later with a proper edit modal
    alert('Edit Structure feature will be implemented soon!');
    setShowMenu(false);
  };

  const handleDuplicateTable = () => {
    duplicateTable(data.id);
    setShowMenu(false);
  };

  const updateNewRowData = (columnName: string, value: any) => {
    setNewRowData(prev => ({ ...prev, [columnName]: value }));
  };

  const renderInputForColumn = (column: any, value: any) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm";

    if (column.type.includes('BOOLEAN') || column.type.includes('BIT')) {
      return (
        <select
          value={value || 'false'}
          onChange={(e) => updateNewRowData(column.name, e.target.value === 'true')}
          className={baseClasses}
        >
          <option value="false">False</option>
          <option value="true">True</option>
        </select>
      );
    }

    if (column.type.includes('DATE')) {
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => updateNewRowData(column.name, e.target.value)}
          className={baseClasses}
        />
      );
    }

    if (column.type.includes('DATETIME') || column.type.includes('TIMESTAMP')) {
      return (
        <input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => updateNewRowData(column.name, e.target.value)}
          className={baseClasses}
        />
      );
    }

    if (column.type.includes('INT') || column.type.includes('DECIMAL') || column.type.includes('FLOAT')) {
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => updateNewRowData(column.name, e.target.value)}
          className={baseClasses}
          step={column.type.includes('DECIMAL') || column.type.includes('FLOAT') ? '0.01' : '1'}
        />
      );
    }

    if (column.type.includes('TEXT')) {
      return (
        <textarea
          value={value || ''}
          onChange={(e) => updateNewRowData(column.name, e.target.value)}
          className={baseClasses}
          rows={3}
        />
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => updateNewRowData(column.name, e.target.value)}
        className={baseClasses}
      />
    );
  };

  return (
    <div className={`
      bg-white dark:bg-gray-800 border-2 rounded-lg shadow-lg min-w-64 max-w-80 relative
      ${selected 
        ? 'border-sky-500 shadow-sky-200 dark:shadow-sky-900' 
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }
      transition-all duration-200
    `}>
      {/* Table Header */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
              {data.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {data.rowCount} rows
            </span>
            
            {/* More Options Menu */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors duration-200"
                title="More options"
              >
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowMenu(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                    <div className="py-1">
                      <button
                        onClick={handleAddRow}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <Plus className="w-4 h-4 text-green-500" />
                        Add Row
                      </button>
                      
                      <button
                        onClick={handleEditTable}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                        Edit Structure
                      </button>
                      
                      <button
                        onClick={handleDuplicateTable}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <Copy className="w-4 h-4 text-purple-500" />
                        Duplicate Table
                      </button>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Table
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="p-0">
        {data.columns.map((column, index) => (
          <div
            key={column.id}
            className="relative flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
          >
            {/* Source Handle for connections */}
            <Handle
              type="source"
              position={Position.Right}
              id={column.id}
              className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white dark:!border-gray-800 !right-[-6px]"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />

            {/* Target Handle for connections */}
            <Handle
              type="target"
              position={Position.Left}
              id={column.id}
              className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white dark:!border-gray-800 !left-[-6px]"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />

            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Key Icons */}
              <div className="flex gap-1">
                {column.isPrimaryKey && (
                  <Key className="w-3 h-3 text-yellow-500 flex-shrink-0" /*title="Primary Key"*/ />
                )}
                {column.isForeignKey && (
                  <Link2 className="w-3 h-3 text-blue-500 flex-shrink-0" /*title="Foreign Key"*/ />
                )}
                {column.isUnique && (
                  <div className="w-3 h-3 bg-purple-500 rounded-full flex-shrink-0" title="Unique" />
                )}
                {column.isIndexed && (
                  <div className="w-3 h-3 bg-green-500 rounded-sm flex-shrink-0" title="Indexed" />
                )}
              </div>

              {/* Column Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                  {column.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {column.type}
                  {!column.nullable && (
                    <span className="ml-1 text-red-500 font-medium">NOT NULL</span>
                  )}
                  {column.defaultValue && (
                    <span className="ml-1 text-green-600 dark:text-green-400">
                      DEFAULT: {column.defaultValue}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {data.columns.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            No columns defined
          </div>
        )}
      </div>

      {/* Table Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{data.columns.length} columns</span>
          <div className="flex items-center gap-2">
            <span>{data.rowCount} rows</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="hover:text-red-500 transition-colors duration-200 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              title="Delete table"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Row Modal */}
      {showAddRowModal && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Add New Row - {data.name}
                </h3>
                <button
                  onClick={() => setShowAddRowModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {data.columns.map(column => (
                  <div key={column.id}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {column.name}
                      <span className="ml-1 text-xs text-gray-500">({column.type})</span>
                      {!column.nullable && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    {renderInputForColumn(column, newRowData[column.name])}
                    {column.defaultValue && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Default: {column.defaultValue}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowAddRowModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewRow}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete Table
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete table <strong>"{data.name}"</strong>? 
                All data and relationships will be permanently removed.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTable}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Table
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

TableNode.displayName = 'TableNode';

export default TableNode;