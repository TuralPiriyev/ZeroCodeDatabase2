export interface ParsedStatement {
  type: 'CREATE_TABLE' | 'ALTER_TABLE' | 'DROP_TABLE' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';
  tableName?: string;
  columns?: ParsedColumn[];
  operation?: string;
  conditions?: any;
  values?: any;
}

export interface ParsedColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
}

export class SQLParser {
  static parseStatement(sql: string): ParsedStatement {
    const trimmed = sql.trim().replace(/;$/, '');
    const upperSQL = trimmed.toUpperCase();

    if (upperSQL.startsWith('CREATE TABLE')) {
      return this.parseCreateTable(trimmed);
    } else if (upperSQL.startsWith('ALTER TABLE')) {
      return this.parseAlterTable(trimmed);
    } else if (upperSQL.startsWith('DROP TABLE')) {
      return this.parseDropTable(trimmed);
    } else if (upperSQL.startsWith('INSERT')) {
      return this.parseInsert(trimmed);
    } else if (upperSQL.startsWith('UPDATE')) {
      return this.parseUpdate(trimmed);
    } else if (upperSQL.startsWith('DELETE')) {
      return this.parseDelete(trimmed);
    } else if (upperSQL.startsWith('SELECT')) {
      return this.parseSelect(trimmed);
    }

    throw new Error(`Unsupported SQL statement: ${sql}`);
  }

  private static parseCreateTable(sql: string): ParsedStatement {
    // Extract table name
    const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i);
    if (!tableNameMatch) {
      throw new Error('Invalid CREATE TABLE statement: table name not found');
    }

    const tableName = tableNameMatch[1];

    // Extract column definitions
    const columnMatch = sql.match(/\((.*)\)/s);
    if (!columnMatch) {
      throw new Error('Invalid CREATE TABLE statement: column definitions not found');
    }

    const columns = this.parseColumnDefinitions(columnMatch[1]);

    return {
      type: 'CREATE_TABLE',
      tableName,
      columns
    };
  }

  private static parseColumnDefinitions(columnDefs: string): ParsedColumn[] {
    const columns: ParsedColumn[] = [];
    
    // Split by commas, but be careful of commas inside parentheses
    const parts = this.splitByComma(columnDefs);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Skip constraint definitions for now
      if (trimmed.toUpperCase().startsWith('CONSTRAINT') || 
          trimmed.toUpperCase().startsWith('PRIMARY KEY') ||
          trimmed.toUpperCase().startsWith('FOREIGN KEY') ||
          trimmed.toUpperCase().startsWith('UNIQUE') ||
          trimmed.toUpperCase().startsWith('INDEX')) {
        continue;
      }

      const column = this.parseColumnDefinition(trimmed);
      if (column) {
        columns.push(column);
      }
    }

    return columns;
  }

  private static parseColumnDefinition(def: string): ParsedColumn | null {
    const parts = def.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const name = parts[0].replace(/[`'"]/g, '');
    const type = parts[1];
    
    const upperDef = def.toUpperCase();
    
    const column: ParsedColumn = {
      name,
      type,
      nullable: !upperDef.includes('NOT NULL'),
      primaryKey: upperDef.includes('PRIMARY KEY'),
      unique: upperDef.includes('UNIQUE')
    };

    // Extract default value
    const defaultMatch = def.match(/DEFAULT\s+([^,\s]+)/i);
    if (defaultMatch) {
      column.defaultValue = defaultMatch[1].replace(/['"]/g, '');
    }

    // Extract foreign key reference
    const referencesMatch = def.match(/REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/i);
    if (referencesMatch) {
      column.references = {
        table: referencesMatch[1],
        column: referencesMatch[2]
      };
    }

    return column;
  }

  private static parseAlterTable(sql: string): ParsedStatement {
    const tableNameMatch = sql.match(/ALTER\s+TABLE\s+`?(\w+)`?/i);
    if (!tableNameMatch) {
      throw new Error('Invalid ALTER TABLE statement: table name not found');
    }

    const tableName = tableNameMatch[1];
    
    // Determine the operation
    let operation = '';
    if (sql.toUpperCase().includes('ADD COLUMN')) {
      operation = 'ADD_COLUMN';
    } else if (sql.toUpperCase().includes('DROP COLUMN')) {
      operation = 'DROP_COLUMN';
    } else if (sql.toUpperCase().includes('MODIFY COLUMN')) {
      operation = 'MODIFY_COLUMN';
    } else if (sql.toUpperCase().includes('ADD CONSTRAINT')) {
      operation = 'ADD_CONSTRAINT';
    }

    return {
      type: 'ALTER_TABLE',
      tableName,
      operation
    };
  }

  private static parseDropTable(sql: string): ParsedStatement {
    const tableNameMatch = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?(\w+)`?/i);
    if (!tableNameMatch) {
      throw new Error('Invalid DROP TABLE statement: table name not found');
    }

    return {
      type: 'DROP_TABLE',
      tableName: tableNameMatch[1]
    };
  }

  private static parseInsert(sql: string): ParsedStatement {
    const tableNameMatch = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
    if (!tableNameMatch) {
      throw new Error('Invalid INSERT statement: table name not found');
    }

    return {
      type: 'INSERT',
      tableName: tableNameMatch[1]
    };
  }

  private static parseUpdate(sql: string): ParsedStatement {
    const tableNameMatch = sql.match(/UPDATE\s+`?(\w+)`?/i);
    if (!tableNameMatch) {
      throw new Error('Invalid UPDATE statement: table name not found');
    }

    return {
      type: 'UPDATE',
      tableName: tableNameMatch[1]
    };
  }

  private static parseDelete(sql: string): ParsedStatement {
    const tableNameMatch = sql.match(/DELETE\s+FROM\s+`?(\w+)`?/i);
    if (!tableNameMatch) {
      throw new Error('Invalid DELETE statement: table name not found');
    }

    return {
      type: 'DELETE',
      tableName: tableNameMatch[1]
    };
  }

  private static parseSelect(sql: string): ParsedStatement {
    const fromMatch = sql.match(/FROM\s+`?(\w+)`?/i);
    
    return {
      type: 'SELECT',
      tableName: fromMatch ? fromMatch[1] : undefined
    };
  }

  private static splitByComma(str: string): string[] {
    const parts: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === '(') {
        parenDepth++;
      } else if (!inQuotes && char === ')') {
        parenDepth--;
      } else if (!inQuotes && char === ',' && parenDepth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  static validateSQL(sql: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic syntax validation
    if (!sql.trim()) {
      errors.push('SQL cannot be empty');
      return { isValid: false, errors };
    }
    
    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses');
    }
    
    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    const doubleQuotes = (sql.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push('Unbalanced single quotes');
    }
    if (doubleQuotes % 2 !== 0) {
      errors.push('Unbalanced double quotes');
    }
    
    // Check for semicolons
    const statements = sql.split(';').filter(s => s.trim());
    if (statements.length === 0) {
      errors.push('No valid SQL statements found');
    }
    
    // Advanced validation for each statement
    statements.forEach((statement, index) => {
      const trimmedStatement = statement.trim();
      if (!trimmedStatement) return;
      
      try {
        // Validate CREATE TABLE statements
        if (trimmedStatement.toUpperCase().startsWith('CREATE TABLE')) {
          this.validateCreateTable(trimmedStatement, errors, index + 1);
        }
        
        // Validate ALTER TABLE statements
        if (trimmedStatement.toUpperCase().startsWith('ALTER TABLE')) {
          this.validateAlterTable(trimmedStatement, errors, index + 1);
        }
        
        // Validate INSERT statements
        if (trimmedStatement.toUpperCase().startsWith('INSERT')) {
          this.validateInsert(trimmedStatement, errors, index + 1);
        }
        
        // Validate SELECT statements
        if (trimmedStatement.toUpperCase().startsWith('SELECT')) {
          this.validateSelect(trimmedStatement, errors, index + 1);
        }
        
        // Validate UPDATE statements
        if (trimmedStatement.toUpperCase().startsWith('UPDATE')) {
          this.validateUpdate(trimmedStatement, errors, index + 1);
        }
        
        // Validate DELETE statements
        if (trimmedStatement.toUpperCase().startsWith('DELETE')) {
          this.validateDelete(trimmedStatement, errors, index + 1);
        }
        
      } catch (error) {
        errors.push(`Statement ${index + 1}: ${error instanceof Error ? error.message : 'Invalid syntax'}`);
      }
    });
    
    return { isValid: errors.length === 0, errors };
  }
  
  private static validateCreateTable(sql: string, errors: string[], statementIndex: number): void {
    // Check for valid table name
    const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i);
    if (!tableNameMatch) {
      errors.push(`Statement ${statementIndex}: CREATE TABLE - Invalid table name`);
      return;
    }
    
    const tableName = tableNameMatch[1];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      errors.push(`Statement ${statementIndex}: CREATE TABLE - Invalid table name "${tableName}"`);
    }
    
    // Check for column definitions
    const columnMatch = sql.match(/\((.*)\)/s);
    if (!columnMatch) {
      errors.push(`Statement ${statementIndex}: CREATE TABLE - Missing column definitions`);
      return;
    }
    
    // Validate column definitions
    const columnDefs = columnMatch[1];
    const columns = this.splitByComma(columnDefs);
    
    columns.forEach((colDef, index) => {
      const trimmed = colDef.trim();
      if (!trimmed || trimmed.toUpperCase().startsWith('CONSTRAINT') || 
          trimmed.toUpperCase().startsWith('PRIMARY KEY') ||
          trimmed.toUpperCase().startsWith('FOREIGN KEY') ||
          trimmed.toUpperCase().startsWith('UNIQUE') ||
          trimmed.toUpperCase().startsWith('INDEX')) {
        return;
      }
      
      // Validate column definition
      const columnParts = trimmed.split(/\s+/);
      if (columnParts.length < 2) {
        errors.push(`Statement ${statementIndex}: Column ${index + 1} - Invalid column definition`);
        return;
      }
      
      const columnName = columnParts[0];
      const columnType = columnParts[1];
      
      // Validate column name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
        errors.push(`Statement ${statementIndex}: Column ${index + 1} - Invalid column name "${columnName}"`);
      }
      
      // Validate column type
      const validTypes = [
        'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
        'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
        'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
        'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
        'BOOLEAN', 'BOOL', 'BIT',
        'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'TINYBLOB',
        'JSON', 'ENUM', 'SET'
      ];
      
      const baseType = columnType.replace(/\([^)]*\)/, '').toUpperCase();
      if (!validTypes.includes(baseType)) {
        errors.push(`Statement ${statementIndex}: Column ${index + 1} - Invalid data type "${columnType}"`);
      }
    });
  }
  
  private static validateAlterTable(sql: string, errors: string[], statementIndex: number): void {
    // Check for valid table name
    const tableNameMatch = sql.match(/ALTER\s+TABLE\s+`?(\w+)`?/i);
    if (!tableNameMatch) {
      errors.push(`Statement ${statementIndex}: ALTER TABLE - Invalid table name`);
      return;
    }
    
    const tableName = tableNameMatch[1];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      errors.push(`Statement ${statementIndex}: ALTER TABLE - Invalid table name "${tableName}"`);
    }
    
    // Check for valid operation
    const operationMatch = sql.match(/ALTER\s+TABLE\s+`?\w+`?\s+(ADD|DROP|MODIFY|CHANGE|RENAME)/i);
    if (!operationMatch) {
      errors.push(`Statement ${statementIndex}: ALTER TABLE - Invalid operation`);
    }
  }
  
  private static validateInsert(sql: string, errors: string[], statementIndex: number): void {
    // Check for valid table name
    const tableNameMatch = sql.match(/INSERT\s+(?:INTO\s+)?`?(\w+)`?/i);
    if (!tableNameMatch) {
      errors.push(`Statement ${statementIndex}: INSERT - Invalid table name`);
      return;
    }
    
    const tableName = tableNameMatch[1];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      errors.push(`Statement ${statementIndex}: INSERT - Invalid table name "${tableName}"`);
    }
    
    // Check for VALUES clause
    if (!sql.toUpperCase().includes('VALUES')) {
      errors.push(`Statement ${statementIndex}: INSERT - Missing VALUES clause`);
    }
  }
  
  private static validateSelect(sql: string, errors: string[], statementIndex: number): void {
    // Check for FROM clause
    if (!sql.toUpperCase().includes('FROM')) {
      errors.push(`Statement ${statementIndex}: SELECT - Missing FROM clause`);
    }
    
    // Check for valid table names in FROM clause
    const fromMatch = sql.match(/FROM\s+`?(\w+)`?/i);
    if (fromMatch) {
      const tableName = fromMatch[1];
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        errors.push(`Statement ${statementIndex}: SELECT - Invalid table name "${tableName}"`);
      }
    }
  }
  
  private static validateUpdate(sql: string, errors: string[], statementIndex: number): void {
    // Check for valid table name
    const tableNameMatch = sql.match(/UPDATE\s+`?(\w+)`?/i);
    if (!tableNameMatch) {
      errors.push(`Statement ${statementIndex}: UPDATE - Invalid table name`);
      return;
    }
    
    const tableName = tableNameMatch[1];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      errors.push(`Statement ${statementIndex}: UPDATE - Invalid table name "${tableName}"`);
    }
    
    // Check for SET clause
    if (!sql.toUpperCase().includes('SET')) {
      errors.push(`Statement ${statementIndex}: UPDATE - Missing SET clause`);
    }
  }
  
  private static validateDelete(sql: string, errors: string[], statementIndex: number): void {
    // Check for valid table name
    const tableNameMatch = sql.match(/DELETE\s+(?:FROM\s+)?`?(\w+)`?/i);
    if (!tableNameMatch) {
      errors.push(`Statement ${statementIndex}: DELETE - Invalid table name`);
      return;
    }
    
    const tableName = tableNameMatch[1];
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      errors.push(`Statement ${statementIndex}: DELETE - Invalid table name "${tableName}"`);
    }
  }
}

export default SQLParser;