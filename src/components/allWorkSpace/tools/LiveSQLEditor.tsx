import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { Play, Save, RotateCcw, AlertCircle, CheckCircle, Download, XCircle } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useDatabase } from '../../../context/DatabaseContext';
import { useSubscription } from '../../../context/SubscriptionContext';

interface SQLError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: string;
}


interface ExecutionResult {
  success: boolean;
  message: string;
  affectedTables?: string[];
  executionTime?: number;
  rowsAffected?: number;
}

const LiveSQLEditor: React.FC = () => {

    
  const { isDark } = useTheme();
  const { currentSchema, executeSQL, addTable, updateTable, removeTable } = useDatabase();
  const { isLimitReached, setShowUpgradeModal, setUpgradeReason } = useSubscription(); // ← və burada

  const [sql, setSql] = useState(`-- Live SQL Editor
-- Changes are applied automatically to your schema

-- Example: Create a new table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example: Add a foreign key relationship
-- ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users(id);
`);
  
  const [sqlErrors, setSqlErrors] = useState<SQLError[]>([]);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoExecute, setAutoExecute] = useState(false);
  const [lastSavedSql, setLastSavedSql] = useState('');
  
  const editorRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure SQL language features
    monaco.languages.setLanguageConfiguration('sql', {
      comments: {
        lineComment: '--',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['(', ')'],
        ['[', ']']
      ],
      autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: "'", close: "'" },
        { open: '"', close: '"' }
      ]
    });

    // Add custom SQL validation
    monaco.languages.registerHoverProvider('sql', {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (word) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `**${word.word}**` },
              { value: 'SQL keyword or identifier' }
            ]
          };
        }
      }
    });

    // Completion provider: suggest table names and table columns when user types a dot (e.g. "team.")
    try {
      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', '"', '`'],
        provideCompletionItems: (model: any, position: any) => {
          try {
            const lineContent: string = model.getLineContent(position.lineNumber).substring(0, position.column - 1);

            // If user typed something like `tableName.` then show that table's columns
            const tableDotMatch = lineContent.match(/([A-Za-z0-9_`"]+)\.$/);
            if (tableDotMatch) {
              let raw = tableDotMatch[1];
              // strip backticks/quotes
              raw = raw.replace(/^\`|\`$/g, '').replace(/^\"|\"$/g, '');
              const tableName = raw;
              const table = currentSchema?.tables?.find((t: any) => t.name === tableName || t.name.toLowerCase() === tableName.toLowerCase());
              if (table && Array.isArray(table.columns)) {
                const suggestions = table.columns.map((col: any) => ({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Property,
                  insertText: col.name,
                  detail: col.type || 'column'
                }));
                return { suggestions };
              }
            }

            // Default: suggest table names (helpful when user is starting a statement)
            const tableSuggestions = (currentSchema?.tables || []).map((t: any) => ({
              label: t.name,
              kind: monaco.languages.CompletionItemKind.Struct,
              insertText: t.name,
              detail: `${(t.columns || []).length} columns`
            }));

            return { suggestions: tableSuggestions };
          } catch (err) {
            return { suggestions: [] };
          }
        }
      });
    } catch (err) {
      // some Monaco builds may not support registering providers at runtime in the same way; ignore gracefully
      // eslint-disable-next-line no-console
      console.warn('Could not register Monaco completion provider', err);
    }

    // Set up real-time error markers
    updateErrorMarkers(monaco);
  };

    // When the schema's tables change, prompt Monaco to refresh suggestions so completion lists table/column names
    useEffect(() => {
      if (!editorRef.current) return;
      try {
        // trigger Monaco's suggest widget refresh
        editorRef.current.trigger && editorRef.current.trigger('user', 'editor.action.triggerSuggest', {});
      } catch (err) {
        // ignore errors - best-effort
      }
    }, [currentSchema?.tables]);

  const updateErrorMarkers = useCallback((monaco?: any) => {
    if (!editorRef.current || !monaco) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const markers = sqlErrors.map(error => ({
      startLineNumber: error.line,
      startColumn: error.column,
      endLineNumber: error.line,
      endColumn: error.column + 10,
      message: error.message,
      severity: error.severity === 'error' ? 8 : error.severity === 'warning' ? 4 : 1
    }));

    monaco.editor.setModelMarkers(model, 'sql-validator', markers);
  }, [sqlErrors]);

  const validateSQL = useCallback((sqlText: string) => {
    const errors: SQLError[] = [];
    const lines = sqlText.split('\n');

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Basic SQL syntax validation
      if (trimmedLine && !trimmedLine.startsWith('--')) {
        // Check for common SQL errors
        if (trimmedLine.toUpperCase().includes('CREATE TABLE') && !trimmedLine.includes('(')) {
          errors.push({
            line: index + 1,
            column: 1,
            message: 'CREATE TABLE statement missing column definitions',
            severity: 'error'
          });
        }
        
        // Check for missing semicolons on complete statements
        if (trimmedLine.toUpperCase().match(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)/) && 
            !trimmedLine.endsWith(';') && 
            !lines[index + 1]?.trim().startsWith('(')) {
          errors.push({
            line: index + 1,
            column: line.length,
            message: 'Statement should end with semicolon',
            severity: 'warning'
          });
        }
      }
    });

    setSqlErrors(errors);
  }, []);

  const parseAndExecuteSQL = useCallback(async (sqlText: string) => {
    setIsExecuting(true);
    const results: ExecutionResult[] = [];
    
    try {
      // Split SQL into individual statements
      const statements = sqlText
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--'));

      for (const statement of statements) {
        const startTime = Date.now();
        
        try {
          // Parse statement type
          const upperStatement = statement.toUpperCase();
          
          if (upperStatement.startsWith('CREATE TABLE')) {
            await handleCreateTable(statement);
            results.push({
              success: true,
              message: 'Table created successfully',
              executionTime: Date.now() - startTime,
              affectedTables: [extractTableName(statement)]
            });
          } else if (upperStatement.startsWith('ALTER TABLE')) {
            await handleAlterTable(statement);
            results.push({
              success: true,
              message: 'Table altered successfully',
              executionTime: Date.now() - startTime,
              affectedTables: [extractTableName(statement)]
            });
          } else if (upperStatement.startsWith('DROP TABLE')) {
            await handleDropTable(statement);
            results.push({
              success: true,
              message: 'Table dropped successfully',
              executionTime: Date.now() - startTime,
              affectedTables: [extractTableName(statement)]
            });
          } else {
            // Execute other SQL statements
            const result = await executeSQL(statement);
            results.push({
              success: true,
              message: 'Statement executed successfully',
              executionTime: Date.now() - startTime,
              rowsAffected: result.values?.length || 0
            });
          }
        } catch (error) {
          results.push({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - startTime
          });
        }
      }
    } catch (error) {
      results.push({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse SQL'
      });
    }
    
    setExecutionResults(results);
    setIsExecuting(false);
  }, [executeSQL, addTable, updateTable, removeTable]);

  const handleCreateTable = async (statement: string) => {
    // Parse CREATE TABLE statement
    const tableName = extractTableName(statement);
    const columns = parseColumnDefinitions(statement);
    
    if (tableName && columns.length > 0) {
      // Check table limit before allowing creation
      if (isLimitReached('maxTables', currentSchema.tables.length)) {
        setUpgradeReason('Reached max tables — upgrade to add more.');
        setShowUpgradeModal(true);
        throw new Error('You have reached the maximum number of tables for your plan. Upgrade to create more tables.');
      }

      const tableData = {
        name: tableName,
        columns: columns.map(col => ({ ...col, id: crypto.randomUUID() })),
        position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 }
      };
      
      addTable(tableData);
    }
  };

  const handleAlterTable = async (statement: string) => {
    // Parse ALTER TABLE statement
    const tableName = extractTableName(statement);
    const table = currentSchema.tables.find(t => t.name === tableName);
    
    if (table) {
      // This would implement ALTER TABLE logic
      console.log('ALTER TABLE:', statement);
    }
  };

  const handleDropTable = async (statement: string) => {
    const tableName = extractTableName(statement);
    const table = currentSchema.tables.find(t => t.name === tableName);
    
    if (table) {
      removeTable(table.id);
    }
  };

  const extractTableName = (statement: string): string => {
    const match = statement.match(/(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?`?(\w+)`?/i);
    return match ? match[1] : '';
  };

  const parseColumnDefinitions = (statement: string): ColumnDefinition[] => {
      const columns: ColumnDefinition[] = [];

    // Basic column parsing - would be more sophisticated in production
    const columnMatch = statement.match(/\((.*)\)/s);
    
    if (columnMatch) {
      const columnDefs = columnMatch[1].split(',');
      
      columnDefs.forEach(def => {
        const trimmed = def.trim();
        const parts = trimmed.split(/\s+/);
        
        if (parts.length >= 2) {
          columns.push({
            name: parts[0].replace(/`/g, ''),
            type: parts[1],
            nullable: !trimmed.toUpperCase().includes('NOT NULL'),
            isPrimaryKey: trimmed.toUpperCase().includes('PRIMARY KEY'),
            isUnique: trimmed.toUpperCase().includes('UNIQUE'),
            defaultValue: extractDefaultValue(trimmed)
          });
        }
      });
    }
    
    return columns;
  };

  const extractDefaultValue = (columnDef: string): string | undefined => {
    const match = columnDef.match(/DEFAULT\s+([^,\s]+)/i);
    return match ? match[1].replace(/['"]/g, '') : undefined;
  };

  const handleSqlChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setSql(value);
      validateSQL(value);
      
      if (autoExecute) {
        // Debounce auto-execution
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          parseAndExecuteSQL(value);
        }, 2000); // Increased debounce time for better UX
      }
    }
  }, [autoExecute, validateSQL, parseAndExecuteSQL]);

  const handleManualExecute = () => {
    parseAndExecuteSQL(sql);
  };

  const handleSave = () => {
    setLastSavedSql(sql);
    // In a real app, this would save to backend
    console.log('SQL saved');
  };

  const handleReset = () => {
    setSql(lastSavedSql || '');
    setSqlErrors([]);
    setExecutionResults([]);
  };

  const exportSQL = () => {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSchema.name.toLowerCase().replace(/\s+/g, '_')}_live_sql.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live SQL Editor
          </h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Auto-execute</span>
            </label>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualExecute}
            disabled={isExecuting}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <Play className="w-4 h-4" />
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
          
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          
          <button
            onClick={exportSQL}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Editor and Results: use flex column so Monaco can size correctly
          Editor gets ~70% and Results ~30% of the remaining area */}
  <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: 320 }}>
        {/* Editor enlarged to a 10:1 ratio vs results (≈91% editor, 9% results) per user request */}
        <div className="flex-[10] min-h-0 border-b border-gray-200 dark:border-gray-700 flex">
          {/* Wrapper ensures Monaco receives a real height (avoids the 5px collapsed height) */}
          <div className="w-full h-full min-h-0" style={{ minHeight: 260, height: '100%' }}>
            <Editor
              height="100%"
              language="sql"
              theme={isDark ? 'vs-dark' : 'vs-light'}
              value={sql}
              onChange={handleSqlChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 18,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                folding: true,
                selectOnLineNumbers: true,
                automaticLayout: true,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on'
              }}
            />
          </div>
        </div>

        {/* Results Panel (kept very small per user request) */}
        <div className="flex-[1] overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Execution Results
            </h4>
            {sqlErrors.length > 0 && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{sqlErrors.length} validation issues</span>
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {sqlErrors.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Validation Issues:
              </h5>
              <div className="space-y-2">
                {sqlErrors.map((error, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-800 dark:text-red-200">
                        Line {error.line}, Column {error.column}
                      </div>
                      <div className="text-red-700 dark:text-red-300">
                        {error.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Results */}
          {executionResults.length > 0 && (
            <div className="space-y-2">
              {executionResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-3 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      result.success 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {result.message}
                    </div>
                    {result.executionTime && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Executed in {result.executionTime}ms
                        {result.rowsAffected !== undefined && ` • ${result.rowsAffected} rows affected`}
                        {result.affectedTables && ` • Tables: ${result.affectedTables.join(', ')}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {executionResults.length === 0 && sqlErrors.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Execute SQL to see results here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveSQLEditor;