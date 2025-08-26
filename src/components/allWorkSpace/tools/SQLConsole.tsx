import React, { useState, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { Play, Copy, RotateCcw } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useDatabase } from '../../../context/DatabaseContext';

interface QueryResult {
  columns: string[];
  values: any[][];
  error?: string;
  executionTime?: number;
}

const SQLConsole: React.FC = () => {
  const { isDark } = useTheme();
  const { executeSQL } = useDatabase();
  const [query, setQuery] = useState('-- Write your SQL query here\nSELECT * FROM users LIMIT 10;');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      folding: true,
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      cursorStyle: 'line',
      automaticLayout: true,
    });
  };

  const executeQuery = async () => {
    if (!query.trim()) return;
    
    setIsExecuting(true);
    const startTime = Date.now();
    
    try {
      const result = await executeSQL(query);
      const executionTime = Date.now() - startTime;
      
      setResult({
        columns: result.columns || [],
        values: result.values || [],
        executionTime,
      });
    } catch (error) {
      setResult({
        columns: [],
        values: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - startTime,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
  };

  const clearQuery = () => {
    setQuery('');
    setResult(null);
  };

  const insertSnippet = (snippet: string) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      editorRef.current.executeEdits('', [{
        range: selection,
        text: snippet,
        forceMoveMarkers: true,
      }]);
      editorRef.current.focus();
    }
  };

  const snippets = [
    { name: 'SELECT', code: 'SELECT * FROM table_name;' },
    { name: 'INSERT', code: 'INSERT INTO table_name (column1, column2) VALUES (value1, value2);' },
    { name: 'UPDATE', code: 'UPDATE table_name SET column1 = value1 WHERE condition;' },
    { name: 'DELETE', code: 'DELETE FROM table_name WHERE condition;' },
    { name: 'CREATE TABLE', code: 'CREATE TABLE table_name (\n  id INT PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);' },
    { name: 'ALTER TABLE', code: 'ALTER TABLE table_name ADD COLUMN column_name data_type;' },
    { name: 'JOIN', code: 'SELECT * FROM table1 t1\nJOIN table2 t2 ON t1.id = t2.table1_id;' },
    { name: 'GROUP BY', code: 'SELECT column1, COUNT(*) as count\nFROM table_name\nGROUP BY column1;' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Quick Snippets */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Snippets
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {snippets.map((snippet) => (
            <button
              key={snippet.name}
              onClick={() => insertSnippet(snippet.code)}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors duration-200 text-left"
            >
              {snippet.name}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <div className="h-48 border-b border-gray-200 dark:border-gray-700">
          <Editor
            height="100%"
            language="sql"
            theme={isDark ? 'vs-dark' : 'vs-light'}
            value={query}
            onChange={(value) => setQuery(value || '')}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={executeQuery}
            disabled={isExecuting || !query.trim()}
            className="flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
          
          <button
            onClick={copyQuery}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 text-sm"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          
          <button
            onClick={clearQuery}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {result && (
            <div className="p-4">
              {result.error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="text-red-800 dark:text-red-400 font-medium mb-2">
                    Query Error
                  </h4>
                  <p className="text-red-700 dark:text-red-300 text-sm font-mono">
                    {result.error}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Query Results ({result.values.length} rows)
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Executed in {result.executionTime}ms
                    </span>
                  </div>
                  
                  {result.values.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            {result.columns.map((column, index) => (
                              <th
                                key={index}
                                className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.values.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-4 py-2 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No results returned
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SQLConsole;