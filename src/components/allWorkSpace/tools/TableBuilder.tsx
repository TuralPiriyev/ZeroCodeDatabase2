import React, { useState } from 'react';
import { Plus, Trash2, Key, Link2 } from 'lucide-react';
import { useDatabase, Column } from '../../../context/DatabaseContext';
import { v4 as uuidv4 } from 'uuid';

interface TableBuilderState {
  name: string;
  columns: Omit<Column, 'id'>[];
}

const TableBuilder: React.FC = () => {
  const { addTable } = useDatabase();
  const [table, setTable] = useState<TableBuilderState>({
    name: '',
    columns: [],
  });

  const dataTypes = [
    'VARCHAR(255)',
    'INT',
    'BIGINT',
    'DECIMAL(10,2)',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'TIMESTAMP',
    'TEXT',
    'JSON',
  ];

  const addColumn = () => {
    setTable(prev => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          name: '',
          type: 'VARCHAR(255)',
          nullable: true,
          isPrimaryKey: false,
        },
      ],
    }));
  };

  const removeColumn = (index: number) => {
    setTable(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index),
    }));
  };

  const updateColumn = (index: number, updates: Partial<Omit<Column, 'id'>>) => {
    setTable(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => 
        i === index ? { ...col, ...updates } : col
      ),
    }));
  };

  const createTable = () => {
    if (!table.name.trim() || table.columns.length === 0) {
      return;
    }

    const newTable = {
      name: table.name,
      columns: table.columns.map(col => ({ ...col, id: uuidv4() })),
      position: { x: 100, y: 100 },
    };

    addTable(newTable);
    
    // Reset form
    setTable({ name: '', columns: [] });
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Create New Table
        </h3>
        
        {/* Table Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Table Name
          </label>
          <input
            type="text"
            value={table.name}
            onChange={(e) => setTable(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            placeholder="Enter table name"
          />
        </div>

        {/* Add Column Button */}
        <button
          onClick={addColumn}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors duration-200 mb-4"
        >
          <Plus className="w-4 h-4" />
          Add Column
        </button>
      </div>

      {/* Columns List */}
      <div className="flex-1 overflow-y-auto mb-4">
        {table.columns.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No columns yet. Add your first column to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {table.columns.map((column, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Column {index + 1}
                  </span>
                  <button
                    onClick={() => removeColumn(index)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Column Name */}
                  <input
                    type="text"
                    value={column.name}
                    onChange={(e) => updateColumn(index, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Column name"
                  />

                  {/* Data Type */}
                  <select
                    value={column.type}
                    onChange={(e) => updateColumn(index, { type: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    {dataTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  {/* Default Value */}
                  <input
                    type="text"
                    value={column.defaultValue || ''}
                    onChange={(e) => updateColumn(index, { defaultValue: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Default value (optional)"
                  />

                  {/* Checkboxes */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!column.nullable}
                        onChange={(e) => updateColumn(index, { nullable: !e.target.checked })}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Not Null</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={column.isPrimaryKey || false}
                        onChange={(e) => updateColumn(index, { isPrimaryKey: e.target.checked })}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <Key className="w-4 h-4 text-yellow-500" />
                      <span className="text-gray-700 dark:text-gray-300">Primary Key</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={column.isForeignKey || false}
                        onChange={(e) => updateColumn(index, { isForeignKey: e.target.checked })}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <Link2 className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-700 dark:text-gray-300">Foreign Key</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Button */}
      <button
        onClick={createTable}
        disabled={!table.name.trim() || table.columns.length === 0}
        className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 font-medium"
      >
        Create Table
      </button>
    </div>
  );
};

export default TableBuilder;