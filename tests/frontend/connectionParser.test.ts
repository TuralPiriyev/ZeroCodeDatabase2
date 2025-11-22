import { parseConnectionString } from '../../src/utils/connectionParser';

describe('connectionParser', () => {
  it('parses mysql uri', () => {
    const uri = 'mysql://user:pass@127.0.0.1:3306/testdb?ssl=true';
    const p = parseConnectionString(uri as any);
    expect(p.engine).toBe('mysql');
    expect(p.user).toBe('user');
    expect(p.host).toBe('127.0.0.1');
    expect(p.db).toBe('testdb');
    expect(p.params).toHaveProperty('ssl');
  });

  it('parses mongodb uri', () => {
    const uri = 'mongodb://dbuser:dbpass@mongo:27017/mydb';
    const p = parseConnectionString(uri as any);
    expect(p.engine).toBe('mongodb');
    expect(p.user).toBe('dbuser');
    expect(p.db).toBe('mydb');
  });
});
