import React, { useState } from 'react';
import { Play, Save, Trash2, Filter, Plus, Download } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';

interface QueryFilter {
  column: string;
  operator: string;
  value: string;
}

interface QueryJoin {
  type: string;
  table: string;
  condition: string;
}

interface VisualQuery {
  tables: string[];
  columns: string[];
  joins: QueryJoin[];
  filters: QueryFilter[];
  groupBy: string[];
  orderBy: { column: string; direction: string }[];
  limit?: number;
}

const VisualQueryBuilder: React.FC = () => {
  const { currentSchema, executeVisualQuery, saveQuery, removeQuery } = useDatabase();
  const [query, setQuery] = useState<VisualQuery>({
    tables: [],
    columns: [],
    joins: [],
    filters: [],
    groupBy: [],
    orderBy: []
  });
  const [results, setResults] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');

  const operators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN'];
  const joinTypes = ['INNER', 'LEFT', 'RIGHT', 'FULL OUTER'];

  const addTable = (tableId: string) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (table && !query.tables.includes(table.name)) {
      setQuery(prev => ({
        ...prev,
        tables: [...prev.tables, table.name]
      }));
    }
  };

  const removeTable = (tableName: string) => {
    setQuery(prev => ({
      ...prev,
      tables: prev.tables.filter(t => t !== tableName),
      columns: prev.columns.filter(col => !col.startsWith(`${tableName}.`)),
      joins: prev.joins.filter(join => join.table !== tableName),
      filters: prev.filters.filter(filter => !filter.column.startsWith(`${tableName}.`))
    }));
  };

  const addColumn = (tableName: string, columnName: string) => {
    const fullColumnName = `${tableName}.${columnName}`;
    if (!query.columns.includes(fullColumnName)) {
      setQuery(prev => ({
        ...prev,
        columns: [...prev.columns, fullColumnName]
      }));
    }
  };

  const removeColumn = (columnName: string) => {
    setQuery(prev => ({
      ...prev,
      columns: prev.columns.filter(col => col !== columnName)
    }));
  };

  const addFilter = () => {
    setQuery(prev => ({
      ...prev,
      filters: [...prev.filters, { column: '', operator: '=', value: '' }]
    }));
  };

  const updateFilter = (index: number, updates: Partial<QueryFilter>) => {
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.map((filter, i) => 
        i === index ? { ...filter, ...updates } : filter
      )
    }));
  };

  const removeFilter = (index: number) => {
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  };

  const addJoin = () => {
    setQuery(prev => ({
      ...prev,
      joins: [...prev.joins, { type: 'INNER', table: '', condition: '' }]
    }));
  };

  const updateJoin = (index: number, updates: Partial<QueryJoin>) => {
    setQuery(prev => ({
      ...prev,
      joins: prev.joins.map((join, i) => 
        i === index ? { ...join, ...updates } : join
      )
    }));
  };

  const removeJoin = (index: number) => {
    setQuery(prev => ({
      ...prev,
      joins: prev.joins.filter((_, i) => i !== index)
    }));
  };

  const executeQuery = async () => {
    if (query.tables.length === 0) return;

    setIsExecuting(true);
    try {
      const result = await executeVisualQuery(query);
      setResults(result);
    } catch (e) {
      const error = e as Error;
      console.error('Query execution failed:', error);
      setResults({ error: error.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveQuery = () => {
    if (!queryName.trim()) return;

    saveQuery({
      name: queryName,
      description: queryDescription,
      tables: query.tables,
      joins: query.joins,
      filters: query.filters,
      columns: query.columns,
      aggregates: []
    });

    setShowSaveModal(false);
    setQueryName('');
    setQueryDescription('');
  };

  const exportResults = () => {
    if (!results || !results.values) return;

    const csv = [
      results.columns.join(','),
      ...results.values.map((row: any[]) => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getAvailableColumns = () => {
    const columns: { table: string; column: string }[] = [];
    query.tables.forEach(tableName => {
      const table = currentSchema.tables.find(t => t.name === tableName);
      if (table) {
        table.columns.forEach(col => {
          columns.push({ table: tableName, column: col.name });
        });
      }
    });
    return columns;
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Visual Query Builder
        </h3>

        {/* Table Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Tables
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {currentSchema.tables.map(table => (
              <button
                key={table.id}
                onClick={() => addTable(table.id)}
                disabled={query.tables.includes(table.name)}
                className="px-3 py-2 bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 rounded-lg text-sm hover:bg-sky-200 dark:hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {table.name}
              </button>
            ))}
          </div>
          
          {query.tables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {query.tables.map(tableName => (
                <div key={tableName} className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg text-sm">
                  <span>{tableName}</span>
                  <button
                    onClick={() => removeTable(tableName)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column Selection */}
        {query.tables.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Columns
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {query.tables.map(tableName => {
                const table = currentSchema.tables.find(t => t.name === tableName);
                return table ? (
                  <div key={tableName} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">{tableName}</h5>
                    <div className="space-y-1">
                      {table.columns.map(column => (
                        <label key={column.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={query.columns.includes(`${tableName}.${column.name}`)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                addColumn(tableName, column.name);
                              } else {
                                removeColumn(`${tableName}.${column.name}`);
                              }
                            }}
                            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{column.name}</span>
                          <span className="text-gray-500 text-xs">({column.type})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Joins */}
        {query.tables.length > 1 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Joins
              </label>
              <button
                onClick={addJoin}
                className="flex items-center gap-2 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm transition-colors duration-200"
              >
                <Plus className="w-4 h-4" />
                Add Join
              </button>
            </div>
            
            <div className="space-y-3">
              {query.joins.map((join, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={join.type}
                      onChange={(e) => updateJoin(index, { type: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                      {joinTypes.map(type => (
                        <option key={type} value={type}>{type} JOIN</option>
                      ))}
                    </select>
                    
                    <select
                      value={join.table}
                      onChange={(e) => updateJoin(index, { table: e.target.value })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                      <option value="">Select table</option>
                      {query.tables.map(tableName => (
                        <option key={tableName} value={tableName}>{tableName}</option>
                      ))}
                    </select>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={join.condition}
                        onChange={(e) => updateJoin(index, { condition: e.target.value })}
                        placeholder="e.g., table1.id = table2.user_id"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <button
                        onClick={() => removeJoin(index)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filters (WHERE)
            </label>
            <button
              onClick={addFilter}
              className="flex items-center gap-2 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm transition-colors duration-200"
            >
              <Filter className="w-4 h-4" />
              Add Filter
            </button>
          </div>
          
          <div className="space-y-3">
            {query.filters.map((filter, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    value={filter.column}
                    onChange={(e) => updateFilter(index, { column: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Select column</option>
                    {getAvailableColumns().map(({ table, column }) => (
                      <option key={`${table}.${column}`} value={`${table}.${column}`}>
                        {table}.{column}
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, { operator: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    {operators.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                    placeholder="Value"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                  
                  <button
                    onClick={() => removeFilter(index)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={executeQuery}
            disabled={isExecuting || query.tables.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200"
          >
            <Play className="w-4 h-4" />
            {isExecuting ? 'Executing...' : 'Execute Query'}
          </button>
          
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={query.tables.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200"
          >
            <Save className="w-4 h-4" />
            Save Query
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Query Results
            </h4>
            {results.values && results.values.length > 0 && (
              <button
                onClick={exportResults}
                className="flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
          
          {results.error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h5 className="text-red-800 dark:text-red-400 font-medium mb-2">Query Error</h5>
              <p className="text-red-700 dark:text-red-300 text-sm font-mono">{results.error}</p>
            </div>
          ) : results.values && results.values.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {results.columns.map((column: string, index: number) => (
                        <th key={index} className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.values.map((row: any[], rowIndex: number) => (
                      <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                        {row.map((cell: any, cellIndex: number) => (
                          <td key={cellIndex} className="px-4 py-3 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
                            {cell?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : results.values ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No results returned</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Saved Queries */}
      {currentSchema.savedQueries.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
            Saved Queries ({currentSchema.savedQueries.length})
          </h4>
          <div className="space-y-2">
            {currentSchema.savedQueries.map(savedQuery => (
              <div key={savedQuery.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white">{savedQuery.name}</h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{savedQuery.description}</p>
                </div>
                <button
                  onClick={() => removeQuery(savedQuery.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Query Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Save Query
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Query Name
                </label>
                <input
                  type="text"
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Enter query name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={queryDescription}
                  onChange={(e) => setQueryDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  rows={3}
                  placeholder="Describe what this query does"
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuery}
                disabled={!queryName.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200"
              >
                Save Query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualQueryBuilder;