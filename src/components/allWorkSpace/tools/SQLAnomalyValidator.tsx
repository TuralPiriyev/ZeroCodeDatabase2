import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'structure' | 'performance' | 'security' | 'naming';
}

interface ValidationResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  tableId?: string;
  columnId?: string;
  suggestion?: string;
  autoFixAvailable?: boolean;
}

interface SchemaAuditEntry {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  details: string;
  previousState?: any;
  newState?: any;
}

const SQLAnomalyValidator: React.FC = () => {
  const { currentSchema } = useDatabase();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [auditLog, setAuditLog] = useState<SchemaAuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'validation' | 'audit'>('validation');
  const [autoValidate, setAutoValidate] = useState(true);

  const validationRules: ValidationRule[] = [
    {
      id: 'single_primary_key',
      name: 'Single Primary Key',
      description: 'Each table should have exactly one primary key',
      severity: 'error',
      category: 'structure'
    },
    {
      id: 'foreign_key_exists',
      name: 'Foreign Key Target Exists',
      description: 'Foreign key columns must reference existing tables and columns',
      severity: 'error',
      category: 'structure'
    },
    {
      id: 'no_circular_references',
      name: 'No Circular References',
      description: 'Prevent circular foreign key dependencies',
      severity: 'error',
      category: 'structure'
    },
    {
      id: 'unique_constraint_duplicates',
      name: 'Unique Constraint Duplicates',
      description: 'No duplicate unique constraints on same column set',
      severity: 'warning',
      category: 'structure'
    },
    {
      id: 'table_naming_convention',
      name: 'Table Naming Convention',
      description: 'Tables should follow consistent naming patterns',
      severity: 'info',
      category: 'naming'
    },
    {
      id: 'missing_indexes',
      name: 'Missing Indexes',
      description: 'Foreign key columns should have indexes for performance',
      severity: 'warning',
      category: 'performance'
    }
  ];

  useEffect(() => {
    if (autoValidate) {
      validateSchema();
    }
  }, [currentSchema, autoValidate]);

  const validateSchema = () => {
    const results: ValidationResult[] = [];

    // Rule: Single Primary Key
    currentSchema.tables.forEach(table => {
      const primaryKeys = table.columns.filter(col => col.isPrimaryKey);
      if (primaryKeys.length === 0) {
        results.push({
          ruleId: 'single_primary_key',
          severity: 'warning',
          message: `Table '${table.name}' has no primary key`,
          tableId: table.id,
          suggestion: 'Add a primary key column for better data integrity'
        });
      } else if (primaryKeys.length > 1) {
        results.push({
          ruleId: 'single_primary_key',
          severity: 'error',
          message: `Table '${table.name}' has multiple primary keys`,
          tableId: table.id,
          suggestion: 'Remove extra primary key constraints',
          autoFixAvailable: true
        });
      }
    });

    // Rule: Foreign Key Target Exists
    currentSchema.relationships.forEach(rel => {
      const sourceTable = currentSchema.tables.find(t => t.id === rel.sourceTableId);
      const targetTable = currentSchema.tables.find(t => t.id === rel.targetTableId);
      const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
      const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);

      if (!sourceTable || !targetTable) {
        results.push({
          ruleId: 'foreign_key_exists',
          severity: 'error',
          message: 'Foreign key references non-existent table',
          suggestion: 'Remove invalid foreign key or create missing table'
        });
      } else if (!sourceColumn || !targetColumn) {
        results.push({
          ruleId: 'foreign_key_exists',
          severity: 'error',
          message: `Foreign key column not found in table '${sourceTable?.name}' or '${targetTable?.name}'`,
          tableId: sourceTable?.id,
          suggestion: 'Ensure both source and target columns exist'
        });
      }
    });

    // Rule: Circular References
    const checkCircularDependency = (tableId: string, visited: Set<string> = new Set()): boolean => {
      if (visited.has(tableId)) return true;
      visited.add(tableId);

      const outgoingRels = currentSchema.relationships.filter(rel => rel.sourceTableId === tableId);
      for (const rel of outgoingRels) {
        if (checkCircularDependency(rel.targetTableId, new Set(visited))) {
          return true;
        }
      }
      return false;
    };

    currentSchema.tables.forEach(table => {
      if (checkCircularDependency(table.id)) {
        results.push({
          ruleId: 'no_circular_references',
          severity: 'error',
          message: `Circular dependency detected involving table '${table.name}'`,
          tableId: table.id,
          suggestion: 'Review and remove circular foreign key references'
        });
      }
    });

    // Rule: Table Naming Convention
    currentSchema.tables.forEach(table => {
      if (!/^[a-z][a-z0-9_]*$/.test(table.name)) {
        results.push({
          ruleId: 'table_naming_convention',
          severity: 'info',
          message: `Table '${table.name}' doesn't follow snake_case naming convention`,
          tableId: table.id,
          suggestion: 'Use lowercase letters, numbers, and underscores only'
        });
      }
    });

    // Rule: Missing Indexes on Foreign Keys
    currentSchema.relationships.forEach(rel => {
      const sourceTable = currentSchema.tables.find(t => t.id === rel.sourceTableId);
      const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
      
      if (sourceColumn && !sourceColumn.isIndexed && !sourceColumn.isPrimaryKey) {
        results.push({
          ruleId: 'missing_indexes',
          severity: 'warning',
          message: `Foreign key column '${sourceColumn.name}' in table '${sourceTable?.name}' should have an index`,
          tableId: sourceTable?.id,
          columnId: sourceColumn.id,
          suggestion: 'Add an index to improve join performance',
          autoFixAvailable: true
        });
      }
    });

    setValidationResults(results);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const groupedResults = validationResults.reduce((acc, result) => {
    if (!acc[result.severity]) acc[result.severity] = [];
    acc[result.severity].push(result);
    return acc;
  }, {} as Record<string, ValidationResult[]>);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Schema Validation & Audit
          </h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoValidate}
                onChange={(e) => setAutoValidate(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Auto-validate</span>
            </label>
            <button
              onClick={validateSchema}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm transition-colors duration-200"
            >
              Validate Now
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'validation', name: 'Validation Results', icon: Shield },
              { id: 'audit', name: 'Audit Log', icon: Clock }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${activeTab === tab.id
                      ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Validation Results Tab */}
      {activeTab === 'validation' && (
        <div className="flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {groupedResults.error?.length || 0}
              </div>
              <div className="text-sm text-red-800 dark:text-red-200">Errors</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {groupedResults.warning?.length || 0}
              </div>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">Warnings</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {groupedResults.info?.length || 0}
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200">Info</div>
            </div>
          </div>

          {/* Validation Results */}
          {validationResults.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Schema Validation Passed
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                No issues found in your database schema
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedResults).map(([severity, results]) => (
                <div key={severity}>
                  <h5 className="text-md font-medium text-gray-900 dark:text-white mb-3 capitalize">
                    {severity} ({results.length})
                  </h5>
                  <div className="space-y-3">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-4 ${getSeverityColor(result.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(result.severity)}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white mb-1">
                              {result.message}
                            </div>
                            {result.suggestion && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                💡 {result.suggestion}
                              </div>
                            )}
                            {result.autoFixAvailable && (
                              <button className="text-sm bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded transition-colors duration-200">
                                Auto-fix
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {auditLog.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Audit History
                </h4>
                <p className="text-gray-500 dark:text-gray-400">
                  Schema changes will be tracked here
                </p>
              </div>
            ) : (
              auditLog.map(entry => (
                <div
                  key={entry.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {entry.action}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {entry.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    by {entry.user}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {entry.details}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SQLAnomalyValidator;