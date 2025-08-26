export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
}

export interface Column {
  id: string;
  name: string;
  type: DataType;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}

export interface Table {
  id: string;
  name: string;
  position: Position;
  columns: Column[];
}

export interface Position {
  x: number;
  y: number;
}

export enum DataType {
  INTEGER = 'INTEGER',
  TEXT = 'TEXT',
  REAL = 'REAL',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  TIMESTAMP = 'TIMESTAMP',
  VARCHAR = 'VARCHAR',
  NUMERIC = 'NUMERIC',
  FLOAT = 'FLOAT',
  BLOB = 'BLOB',
  CHAR = 'CHAR',
  BIGINT = 'BIGINT',
  SMALLINT = 'SMALLINT',
  UUID = 'UUID',
  SERIAL = 'SERIAL',
  ENUM = 'ENUM',
  JSON = 'JSON',
  ARRAY = 'ARRAY'
}

export interface Relationship {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
}