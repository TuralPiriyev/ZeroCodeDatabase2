import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save, X, RotateCcw } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';

const ZeroCodeCRUDBuilder: React.FC = () => {
  const { currentSchema, insertRow, updateRow, deleteRow, truncateTable } = useDatabase();
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'insert' | 'edit' | null>(null);
  const [editingRow, setEditingRow] = useState<number>(-1);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const selectedTableData = currentSchema.tables.find(t => t.id === selectedTable);

  const openInsertModal = (tableId: string) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (table) {
      setSelectedTable(tableId);
      const initialData: Record<string, any> = {};
      table.columns.forEach(col => {
        initialData[col.name] = col.defaultValue || '';
      });
      setFormData(initialData);
      setActiveModal('insert');
    }
  };

  const openEditModal = (tableId: string, rowIndex: number) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (table && table.data[rowIndex]) {
      setSelectedTable(tableId);
      setEditingRow(rowIndex);
      setFormData({ ...table.data[rowIndex] });
      setActiveModal('edit');
    }
  };

  const handleInsert = () => {
    if (selectedTable) {
      insertRow(selectedTable, formData);
      setActiveModal(null);
      setFormData({});
    }
  };

  const handleUpdate = () => {
    if (selectedTable && editingRow >= 0) {
      updateRow(selectedTable, editingRow, formData);
      setActiveModal(null);
      setFormData({});
      setEditingRow(-1);
    }
  };

  const handleDelete = (tableId: string, rowIndex: number) => {
    if (confirm('Are you sure you want to delete this row?')) {
      deleteRow(tableId, rowIndex);
    }
  };

  const handleTruncate = (tableId: string) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (table && confirm(`Are you sure you want to delete all data from table "${table.name}"? This cannot be undone.`)) {
      truncateTable(tableId);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setFormData({});
    setEditingRow(-1);
    setSelectedTable('');
  };

  const updateFormData = (columnName: string, value: any) => {
    setFormData(prev => ({ ...prev, [columnName]: value }));
  };

  const renderInputForColumn = (column: any, value: any) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

    if (column.type.includes('BOOLEAN') || column.type.includes('BIT')) {
      return (
        <select
          value={value || 'false'}
          onChange={(e) => updateFormData(column.name, e.target.value === 'true')}
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
          onChange={(e) => updateFormData(column.name, e.target.value)}
          className={baseClasses}
        />
      );
    }

    if (column.type.includes('DATETIME') || column.type.includes('TIMESTAMP')) {
      return (
        <input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => updateFormData(column.name, e.target.value)}
          className={baseClasses}
        />
      );
    }

    if (column.type.includes('TIME')) {
      return (
        <input
          type="time"
          value={value || ''}
          onChange={(e) => updateFormData(column.name, e.target.value)}
          className={baseClasses}
        />
      );
    }

    if (column.type.includes('INT') || column.type.includes('DECIMAL') || column.type.includes('FLOAT') || column.type.includes('DOUBLE')) {
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => updateFormData(column.name, e.target.value)}
          className={baseClasses}
          step={column.type.includes('DECIMAL') || column.type.includes('FLOAT') || column.type.includes('DOUBLE') ? '0.01' : '1'}
        />
      );
    }

    if (column.type.includes('TEXT') || column.type.includes('LONGTEXT')) {
      return (
        <textarea
          value={value || ''}
          onChange={(e) => updateFormData(column.name, e.target.value)}
          className={baseClasses}
          rows={4}
        />
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => updateFormData(column.name, e.target.value)}
        className={baseClasses}
      />
    );
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Data Management
        </h3>

        {currentSchema.tables.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-2">No tables available</p>
            <p className="text-sm text-gray-400">Create some tables first to manage data</p>
          </div>
        ) : (
          <div className="space-y-6">
            {currentSchema.tables.map(table => (
              <div key={table.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{table.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {table.columns.length} columns • {table.rowCount} rows
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openInsertModal(table.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Insert Row
                      </button>
                      <button
                        onClick={() => handleTruncate(table.id)}
                        disabled={table.rowCount === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Truncate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table Data */}
                <div className="overflow-x-auto">
                  {table.data.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No data in this table</p>
                      <button
                        onClick={() => openInsertModal(table.id)}
                        className="mt-2 text-sky-600 hover:text-sky-700 text-sm"
                      >
                        Insert your first row
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          {table.columns.map(column => (
                            <th key={column.id} className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                              {column.name}
                              <span className="ml-1 text-xs text-gray-500">({column.type})</span>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.data.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                            {table.columns.map(column => (
                              <td key={column.id} className="px-4 py-3 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
                                {row[column.name]?.toString() || ''}
                              </td>
                            ))}
                            <td className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => openEditModal(table.id, rowIndex)}
                                  className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                  title="Edit row"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(table.id, rowIndex)}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Delete row"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insert/Edit Modal */}
      {activeModal && selectedTableData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeModal === 'insert' ? 'Insert New Row' : 'Edit Row'} - {selectedTableData.name}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {selectedTableData.columns.map(column => (
                <div key={column.id}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {column.name}
                    <span className="ml-1 text-xs text-gray-500">({column.type})</span>
                    {!column.nullable && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {renderInputForColumn(column, formData[column.name])}
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
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={activeModal === 'insert' ? handleInsert : handleUpdate}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                {activeModal === 'insert' ? 'Insert Row' : 'Update Row'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZeroCodeCRUDBuilder;