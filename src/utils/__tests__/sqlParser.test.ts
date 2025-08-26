import { SQLParser } from '../sqlParser';

describe('SQLParser', () => {
  describe('parseStatement', () => {
    it('parses CREATE TABLE statements', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const result = SQLParser.parseStatement(sql);

      expect(result.type).toBe('CREATE_TABLE');
      expect(result.tableName).toBe('users');
      expect(result.columns).toHaveLength(4);
      
      const idColumn = result.columns![0];
      expect(idColumn.name).toBe('id');
      expect(idColumn.type).toBe('INT');
      expect(idColumn.primaryKey).toBe(true);
      expect(idColumn.nullable).toBe(false);
    });

    it('parses ALTER TABLE statements', () => {
      const sql = 'ALTER TABLE users ADD COLUMN phone VARCHAR(20)';
      const result = SQLParser.parseStatement(sql);

      expect(result.type).toBe('ALTER_TABLE');
      expect(result.tableName).toBe('users');
      expect(result.operation).toBe('ADD_COLUMN');
    });

    it('parses DROP TABLE statements', () => {
      const sql = 'DROP TABLE IF EXISTS users';
      const result = SQLParser.parseStatement(sql);

      expect(result.type).toBe('DROP_TABLE');
      expect(result.tableName).toBe('users');
    });

    it('handles foreign key references', () => {
      const sql = `
        CREATE TABLE orders (
          id INT PRIMARY KEY,
          user_id INT REFERENCES users(id),
          total DECIMAL(10,2)
        )
      `;

      const result = SQLParser.parseStatement(sql);
      const userIdColumn = result.columns!.find(col => col.name === 'user_id');

      expect(userIdColumn?.references).toEqual({
        table: 'users',
        column: 'id'
      });
    });
  });

  describe('validateSQL', () => {
    it('validates correct SQL', () => {
      const sql = 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(50))';
      const result = SQLParser.validateSQL(sql);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid SQL', () => {
      const sql = 'CREATE TABLE'; // Incomplete statement
      const result = SQLParser.validateSQL(sql);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles multiple statements', () => {
      const sql = `
        CREATE TABLE users (id INT PRIMARY KEY);
        CREATE TABLE orders (id INT PRIMARY KEY, user_id INT);
      `;
      const result = SQLParser.validateSQL(sql);

      expect(result.isValid).toBe(true);
    });
  });
});