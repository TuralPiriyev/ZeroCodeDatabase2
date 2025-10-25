export type DBType = 'mysql' | 'postgres' | 'mongodb';

export interface DatabaseEntry {
  id: string;
  name: string; // logical name or database name
  type: DBType;
  host: string;
  port?: number;
  admin_uri_encrypted?: string; // encrypted admin URI or credentials
  created_at?: string;
}

export interface ProvisionedUser {
  id: string;
  db_id: string;
  username: string;
  encrypted_password: string;
  roles?: string;
  created_at?: string;
  expires_at?: string | null;
}
