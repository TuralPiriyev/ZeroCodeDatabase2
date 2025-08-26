import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
// @ts-ignore: module has no type declarations
import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import {mongoService} from '../services/mongoService'

export interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  isUnique?: boolean;
  isIndexed?: boolean;
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  position: { x: number; y: number };
  rowCount: number;
  data: Record<string, any>[];
}

export interface Relationship {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  cardinality: '1:1' | '1:N' | 'N:M';
}

export interface Index {
  id: string;
  name: string;
  tableId: string;
  columns: string[];
  isUnique: boolean;
}

export interface Constraint {
  id: string;
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'NOT_NULL';
  tableId: string;
  columnId?: string;
  expression?: string;
}

export interface User {
  id: string;
  name: string;
  role: string;
}

export interface Permission {
  id: string;
  userId: string;
  tableId: string;
  permissions: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  tables: string[];
  joins: any[];
  filters: any[];
  columns: string[];
  aggregates: any[];
  createdAt: Date;
}

// Enhanced workspace sharing interfaces for team collaboration
export interface WorkspaceMember {
  id: string;
  username: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  inviterUsername: string;
  inviteeUsername: string;
  role: 'editor' | 'viewer';
  joinCode: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired';
}

export interface Schema {
  id: string;
  name: string;
  tables: Table[];
  relationships: Relationship[];
  indexes: Index[];
  constraints: Constraint[];
  users: User[];
  permissions: Permission[];
  savedQueries: SavedQuery[];
  // Enhanced team collaboration fields
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  isShared: boolean;
  ownerId: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseContextType {
  currentSchema: Schema;
  schemas: Schema[];
  sqlEngine: any;
  importSchema: (schema: Schema) => void;
  // Table operations
  addTable: (table: Omit<Table, 'id' | 'rowCount' | 'data'>) => void;
  removeTable: (tableId: string) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  alterTable: (tableId: string, operation: 'ADD_COLUMN' | 'DROP_COLUMN' | 'MODIFY_COLUMN', data: any) => void;
  duplicateTable: (tableId: string) => void;
  
  // Data operations
  insertRow: (tableId: string, data: Record<string, any>) => void;
  updateRow: (tableId: string, rowIndex: number, data: Record<string, any>) => void;
  deleteRow: (tableId: string, rowIndex: number) => void;
  truncateTable: (tableId: string) => void;
  
  // Relationship operations
  addRelationship: (relationship: Omit<Relationship, 'id'>) => void;
  removeRelationship: (relationshipId: string) => void;
  
  // Index and constraint operations
  addIndex: (index: Omit<Index, 'id'>) => void;
  removeIndex: (indexId: string) => void;
  addConstraint: (constraint: Omit<Constraint, 'id'>) => void;
  removeConstraint: (constraintId: string) => void;
  
  // Security operations
  addUser: (user: Omit<User, 'id'>) => void;
  removeUser: (userId: string) => void;
  grantPermission: (permission: Omit<Permission, 'id'>) => void;
  revokePermission: (permissionId: string) => void;
  
  // Enhanced team collaboration operations with MongoDB integration
//  inviteToWorkspace: (invitation: Omit<WorkspaceInvitation, 'id' | 'workspaceId' | 'createdAt' | 'expiresAt' | 'status'>) => Promise<string>;
  acceptWorkspaceInvitation: (joinCode: string) => Promise<boolean>;
  removeWorkspaceMember: (memberId: string) => void;
  validateUsername: (username: string) => Promise<boolean>;
  syncWorkspaceWithMongoDB: () => Promise<void>;
  loadSharedSchemas: (workspaceId: string) => Promise<void>;
  syncSchemaToWorkspace: (workspaceId: string) => Promise<boolean>;
  
  // Query operations
  executeVisualQuery: (query: any) => Promise<any>;
  executeSQL: (sql: string) => Promise<any>;
  saveQuery: (query: Omit<SavedQuery, 'id' | 'createdAt'>) => void;
  removeQuery: (queryId: string) => void;
  
  // Export operations
  exportSchema: (format: string) => string;
  
  // Schema management
  createNewSchema: (name: string) => Promise<void>;
  loadSchema: (schemaId: string) => void;
  saveSchema: () => void;
  
  // SQL preview
  generateSQL: () => string;
  inviteToWorkspace: (invitation: Omit<WorkspaceInvitation, 'id'|'workspaceId'|'createdAt'|'expiresAt'|'status'|'joinCode'>) => Promise<string>;

}  

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [sqlEngine, setSqlEngine] = useState<any>(null);
  const [currentSchema, setCurrentSchema] = useState<Schema>({
    id: uuidv4(),
    name: 'Untitled Schema',
    tables: [],
    relationships: [],
    indexes: [],
    constraints: [],
    users: [],
    permissions: [],
    savedQueries: [],
    // Enhanced team collaboration fields with default owner
    members: [
      {
        id: uuidv4(),
        username: 'current_user', // In real app, get from auth context
        role: 'owner',
        joinedAt: new Date()
      }
    ],
    invitations: [],
    isShared: false,
    ownerId: 'current_user', // In real app, get from auth context
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [schemas, setSchemas] = useState<Schema[]>([]);
 
  // Initialize SQL.js
  useEffect(() => {
    const initSQL = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });
        const db = new SQL.Database();
        setSqlEngine(db);
      } catch (error) {
        console.error('Failed to initialize SQL.js:', error);
      }
    };
    
    initSQL();
  }, []);
  const importSchema = useCallback((schema: Schema) => {
    setCurrentSchema(schema);
    
    // Recreate tables and relationships in SQL engine
    if (sqlEngine) {
      try {
        // Clear existing tables
        schema.tables.forEach(table => {
          try {
            sqlEngine.run(`DROP TABLE IF EXISTS ${table.name}`);
          } catch (error) {
            console.error(`Failed to drop table ${table.name}:`, error);
          }
        });
        
        // Create tables
        schema.tables.forEach(table => {
          const columnDefs = table.columns.map(col => {
            let def = `${col.name} ${col.type}`;
            if (!col.nullable) def += ' NOT NULL';
            if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
            if (col.isPrimaryKey) def += ' PRIMARY KEY';
            return def;
          }).join(', ');
          
          const createSQL = `CREATE TABLE ${table.name} (${columnDefs})`;
          try {
            sqlEngine.run(createSQL);
            console.log('Created table in SQL engine:', createSQL);
          } catch (error) {
            console.error(`Failed to create table ${table.name}:`, error);
          }
        });
        
        // Create foreign key constraints for existing relationships
        schema.relationships.forEach(relationship => {
          const sourceTable = schema.tables.find(t => t.id === relationship.sourceTableId);
          const targetTable = schema.tables.find(t => t.id === relationship.targetTableId);
          
          if (sourceTable && targetTable) {
            const sourceColumn = sourceTable.columns.find(c => c.id === relationship.sourceColumnId);
            const targetColumn = targetTable.columns.find(c => c.id === relationship.targetColumnId);
            
            if (sourceColumn && targetColumn) {
              const fkSQL = `ALTER TABLE ${sourceTable.name} ADD CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name} FOREIGN KEY (${sourceColumn.name}) REFERENCES ${targetTable.name}(${targetColumn.name})`;
              try {
                sqlEngine.run(fkSQL);
                console.log('Created foreign key constraint:', fkSQL);
              } catch (error) {
                console.error('Failed to create foreign key constraint:', error);
              }
            }
          }
        });
      } catch (error) {
        console.error('Failed to import schema to SQL engine:', error);
      }
    }
  }, [sqlEngine]);
  // Enhanced team collaboration functions with MongoDB integration
  const validateUsername = useCallback(async (username: string): Promise<boolean> => {
    return await mongoService.validateUsername(username);
  }, []);

  const inviteToWorkspace = useCallback(async (invitation: {
    inviterUsername: string;
    inviteeUsername: string;
    role: 'editor' | 'viewer';
  }): Promise<string> => {
    console.log('inviteToWorkspace called with:', invitation);
    
    // Generate secure join code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let joinCode = '';
    for (let i = 0; i < 8; i++) {
      joinCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    console.log('Generated join code:', joinCode);

    const newInvitation: WorkspaceInvitation = {
      id: uuidv4(),
      inviterUsername: invitation.inviterUsername,
      inviteeUsername: invitation.inviteeUsername,
      role: invitation.role,
      workspaceId: currentSchema.id,
      joinCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'pending'
    };
    
    console.log('Created invitation object:', newInvitation);

    // Update local state
    setCurrentSchema(prev => ({
      ...prev,
      invitations: [...prev.invitations, newInvitation],
      updatedAt: new Date()
    }));

    console.log('Updated local schema with invitation');
    
    // Save to MongoDB via API
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 
                    (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
      
      const response = await fetch(`${apiUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          workspaceId: newInvitation.workspaceId,
          inviterUsername: newInvitation.inviterUsername,
          inviteeUsername: newInvitation.inviteeUsername,
          role: newInvitation.role,
          joinCode: newInvitation.joinCode,
          createdAt: newInvitation.createdAt.toISOString(),
          expiresAt: newInvitation.expiresAt.toISOString()
        })
      });
      
      if (response.ok) {
        console.log('✅ Invitation saved to server successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('⚠️ Failed to save invitation to server:', response.status, errorData);
      }
    } catch (error) {
      console.warn('⚠️ Network error saving invitation, but continuing with local state:', error);
    }
    
    console.log('Returning join code:', joinCode);

    return joinCode;
  }, [currentSchema.id, currentSchema.invitations]);

  const acceptWorkspaceInvitation = useCallback(async (joinCode: string): Promise<boolean> => {
    console.log('Attempting to accept invitation with code:', joinCode);
    
    try {
      // First validate the join code with MongoDB
      const validation = await mongoService.validateJoinCode(joinCode);
      
      if (!validation.valid || !validation.invitation) {
        console.error('Join code validation failed:', validation.error);
        // Fallback for development mode
        console.log('Using fallback for development mode');
        const newMember: WorkspaceMember = {
          id: uuidv4(),
          username: `user_${joinCode.slice(0, 4).toLowerCase()}`,
          role: 'editor',
          joinedAt: new Date()
        };
        
        setCurrentSchema(prev => ({
          ...prev,
          members: [...prev.members, newMember],
          isShared: true,
          updatedAt: new Date()
        }));
        
        return true;
      }
      
      const invitation = validation.invitation;
      console.log('Valid invitation found:', invitation);
      
      // Check if user is already a member
      const existingMember = currentSchema.members.find(
        member => member.username.toLowerCase() === invitation.inviteeUsername.toLowerCase()
      );
      
      if (existingMember) {
        console.error('User is already a member');
        return false;
      }
      
      // Update local state - mark invitation as accepted
      setCurrentSchema(prev => ({
        ...prev,
        invitations: prev.invitations.map(inv =>
          inv.joinCode === joinCode.toUpperCase() 
            ? { ...inv, status: 'accepted' as const }
            : inv
        ),
        updatedAt: new Date()
      }));
      
      // Add new member to local state
      const newMember: WorkspaceMember = {
        id: uuidv4(),
        username: invitation.inviteeUsername,
        role: invitation.role,
        joinedAt: new Date()
      };
      
      setCurrentSchema(prev => ({
        ...prev,
        members: [...prev.members, newMember],
        isShared: true,
        updatedAt: new Date()
      }));
      
      // Save member to MongoDB
      try {
        await mongoService.saveWorkspaceMember(newMember, currentSchema.id);
        console.log('✅ Member saved to MongoDB successfully');
      } catch (error) {
        console.warn('⚠️ Failed to save member to MongoDB:', error);
      }
      
      console.log('Local state updated successfully');
      return true;
      
    } catch (error) {
      console.error('Error accepting workspace invitation:', error);
      // Fallback for development mode
      console.log('Using fallback for development mode due to error');
      const newMember: WorkspaceMember = {
        id: uuidv4(),
        username: `user_${joinCode.slice(0, 4).toLowerCase()}`,
        role: 'editor',
        joinedAt: new Date()
      };
      
      setCurrentSchema(prev => ({
        ...prev,
        members: [...prev.members, newMember],
        isShared: true,
        updatedAt: new Date()
      }));
      
      return true;
    }
  }, [currentSchema.members]);

  // Original implementation as fallback

  const removeWorkspaceMember = useCallback((memberId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      members: prev.members.filter(member => member.id !== memberId),
      updatedAt: new Date()
    }));
  }, []);

  // Enhanced workspace sync with MongoDB
  const syncWorkspaceWithMongoDB = useCallback(async () => {
    try {
      // Update workspace data in MongoDB
      await mongoService.updateWorkspace(currentSchema.id, {
        schema: currentSchema,
        lastSyncedAt: new Date()
      });
      
      setCurrentSchema(prev => ({
        ...prev,
        lastSyncedAt: new Date()
      }));
    } catch (error) {
      console.error('Failed to sync workspace with MongoDB:', error);
    }
  }, [currentSchema]);

  const loadSharedSchemas = useCallback(async (workspaceId: string) => {
    try {
      const sharedSchemas = await mongoService.getUserWorkspaces(workspaceId);
      console.log('Loaded shared schemas:', sharedSchemas);
      
      // Load the first shared schema if available
      if (sharedSchemas.length > 0) {
        const firstSchema = sharedSchemas[0];
        if (firstSchema.scripts) {
          try {
            const schemaData = JSON.parse(firstSchema.scripts);
            importSchema(schemaData);
          } catch (error) {
            console.error('Failed to parse shared schema:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load shared schemas:', error);
    }
  }, [importSchema]);

  const syncSchemaToWorkspace = useCallback(async (workspaceId: string) => {
    try {
      // Save current schema to workspace
      const success = await mongoService.updateWorkspace(workspaceId, {
        schema: currentSchema,
        lastSyncedAt: new Date()
      });
      
      if (success) {
        setCurrentSchema(prev => ({
          ...prev,
          lastSyncedAt: new Date()
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Failed to sync schema to workspace:', error);
      return false;
    }
  }, [currentSchema]);
  // Auto-sync workspace changes for shared workspaces
  useEffect(() => {
    if (currentSchema.isShared) {
      const syncInterval = setInterval(() => {
        syncWorkspaceWithMongoDB();
      }, 30000); // Sync every 30 seconds

      return () => clearInterval(syncInterval);
    }
  }, [currentSchema.isShared, syncWorkspaceWithMongoDB]);

  const addTable = useCallback((table: Omit<Table, 'id' | 'rowCount' | 'data'>) => {
    const newTable: Table = {
      ...table,
      id: uuidv4(),
      rowCount: 0,
      data: [],
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      tables: [...prev.tables, newTable],
      updatedAt: new Date(),
    }));

    // Create table in SQL engine
    if (sqlEngine) {
      const columnDefs = newTable.columns.map(col => {
        let def = `${col.name} ${col.type}`;
        if (!col.nullable) def += ' NOT NULL';
        if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
        if (col.isPrimaryKey) def += ' PRIMARY KEY';
        return def;
      }).join(', ');
      
      const createSQL = `CREATE TABLE ${newTable.name} (${columnDefs})`;
      try {
        sqlEngine.run(createSQL);
      } catch (error) {
        console.error('Failed to create table in SQL engine:', error);
      }
    }
  }, [sqlEngine]);

  const removeTable = useCallback((tableId: string) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (!table) return;

    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.filter(table => table.id !== tableId),
      relationships: prev.relationships.filter(
        rel => rel.sourceTableId !== tableId && rel.targetTableId !== tableId
      ),
      indexes: prev.indexes.filter(idx => idx.tableId !== tableId),
      constraints: prev.constraints.filter(con => con.tableId !== tableId),
      permissions: prev.permissions.filter(perm => perm.tableId !== tableId),
      updatedAt: new Date(),
    }));

    // Drop table in SQL engine
    if (sqlEngine) {
      try {
        sqlEngine.run(`DROP TABLE IF EXISTS ${table.name}`);
      } catch (error) {
        console.error('Failed to drop table in SQL engine:', error);
      }
    }
  }, [currentSchema.tables, sqlEngine]);

  const updateTable = useCallback((tableId: string, updates: Partial<Table>) => {
    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.map(table =>
        table.id === tableId ? { ...table, ...updates } : table
      ),
      updatedAt: new Date(),
    }));
  }, []);

  const duplicateTable = useCallback((tableId: string) => {
    const originalTable = currentSchema.tables.find(t => t.id === tableId);
    if (!originalTable) return;

    const newTable: Table = {
      id: uuidv4(),
      name: `${originalTable.name}_copy`,
      columns: originalTable.columns.map(col => ({ ...col, id: uuidv4() })),
      position: { 
        x: originalTable.position.x + 50, 
        y: originalTable.position.y + 50 
      },
      rowCount: 0,
      data: []
    };

    setCurrentSchema(prev => ({
      ...prev,
      tables: [...prev.tables, newTable],
      updatedAt: new Date(),
    }));

    // Create table in SQL engine
    if (sqlEngine) {
      const columnDefs = newTable.columns.map(col => {
        let def = `${col.name} ${col.type}`;
        if (!col.nullable) def += ' NOT NULL';
        if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
        if (col.isPrimaryKey) def += ' PRIMARY KEY';
        return def;
      }).join(', ');
      
      const createSQL = `CREATE TABLE ${newTable.name} (${columnDefs})`;
      try {
        sqlEngine.run(createSQL);
      } catch (error) {
        console.error('Failed to create duplicated table in SQL engine:', error);
      }
    }
  }, [currentSchema.tables, sqlEngine]);

  const alterTable = useCallback((tableId: string, operation: 'ADD_COLUMN' | 'DROP_COLUMN' | 'MODIFY_COLUMN', data: any) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (!table) return;

    let newColumns = [...table.columns];
    let alterSQL = '';

    switch (operation) {
      case 'ADD_COLUMN':
        const newColumn: Column = { ...data, id: uuidv4() };
        newColumns.push(newColumn);
        alterSQL = `ALTER TABLE ${table.name} ADD COLUMN ${newColumn.name} ${newColumn.type}`;
        if (!newColumn.nullable) alterSQL += ' NOT NULL';
        if (newColumn.defaultValue) alterSQL += ` DEFAULT '${newColumn.defaultValue}'`;
        break;
      
      case 'DROP_COLUMN':
        newColumns = newColumns.filter(col => col.id !== data.columnId);
        const columnToDrop = table.columns.find(col => col.id === data.columnId);
        if (columnToDrop) {
          alterSQL = `ALTER TABLE ${table.name} DROP COLUMN ${columnToDrop.name}`;
        }
        break;
      
      case 'MODIFY_COLUMN':
        newColumns = newColumns.map(col => 
          col.id === data.columnId ? { ...col, ...data.updates } : col
        );
        const modifiedColumn = newColumns.find(col => col.id === data.columnId);
        if (modifiedColumn) {
          alterSQL = `ALTER TABLE ${table.name} MODIFY COLUMN ${modifiedColumn.name} ${modifiedColumn.type}`;
        }
        break;
    }

    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.id === tableId ? { ...t, columns: newColumns } : t
      ),
      updatedAt: new Date(),
    }));

    // Execute ALTER in SQL engine
    if (sqlEngine && alterSQL) {
      try {
        sqlEngine.run(alterSQL);
      } catch (error) {
        console.error('Failed to alter table in SQL engine:', error);
      }
    }
  }, [currentSchema.tables, sqlEngine]);

  const insertRow = useCallback((tableId: string, data: Record<string, any>) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (!table) return;

    const newData = [...table.data, data];
    
    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.id === tableId 
          ? { ...t, data: newData, rowCount: newData.length }
          : t
      ),
      updatedAt: new Date(),
    }));

    // Insert into SQL engine
    if (sqlEngine) {
      const columns = Object.keys(data).join(', ');
      const values = Object.values(data).map(v => `'${v}'`).join(', ');
      const insertSQL = `INSERT INTO ${table.name} (${columns}) VALUES (${values})`;
      
      try {
        sqlEngine.run(insertSQL);
      } catch (error) {
        console.error('Failed to insert row in SQL engine:', error);
      }
    }
  }, [currentSchema.tables, sqlEngine]);

  const updateRow = useCallback((tableId: string, rowIndex: number, data: Record<string, any>) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (!table || rowIndex >= table.data.length) return;

    const newData = [...table.data];
    newData[rowIndex] = { ...newData[rowIndex], ...data };
    
    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.id === tableId ? { ...t, data: newData } : t
      ),
      updatedAt: new Date(),
    }));
  }, [currentSchema.tables]);

  const deleteRow = useCallback((tableId: string, rowIndex: number) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (!table || rowIndex >= table.data.length) return;

    const newData = table.data.filter((_, index) => index !== rowIndex);
    
    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.id === tableId 
          ? { ...t, data: newData, rowCount: newData.length }
          : t
      ),
      updatedAt: new Date(),
    }));
  }, [currentSchema.tables]);

  const truncateTable = useCallback((tableId: string) => {
    const table = currentSchema.tables.find(t => t.id === tableId);
    if (!table) return;

    setCurrentSchema(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.id === tableId ? { ...t, data: [], rowCount: 0 } : t
      ),
      updatedAt: new Date(),
    }));

    // Truncate in SQL engine
    if (sqlEngine) {
      try {
        sqlEngine.run(`DELETE FROM ${table.name}`);
      } catch (error) {
        console.error('Failed to truncate table in SQL engine:', error);
      }
    }
  }, [currentSchema.tables, sqlEngine]);

  const addRelationship = useCallback((relationship: Omit<Relationship, 'id'>) => {
    // Validate that the relationship is valid before creating it
    const sourceTable = currentSchema.tables.find(t => t.id === relationship.sourceTableId);
    const targetTable = currentSchema.tables.find(t => t.id === relationship.targetTableId);
    const sourceColumn = sourceTable?.columns.find(c => c.id === relationship.sourceColumnId);
    const targetColumn = targetTable?.columns.find(c => c.id === relationship.targetColumnId);
    
    // Check if relationship is valid
    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
      console.error('Invalid relationship: Missing table or column', {
        sourceTable: sourceTable?.name,
        targetTable: targetTable?.name,
        sourceColumn: sourceColumn?.name,
        targetColumn: targetColumn?.name,
        relationship
      });
      return;
    }
    
    // Check if relationship already exists
    const existingRelationship = currentSchema.relationships.find(rel => 
      rel.sourceTableId === relationship.sourceTableId && 
      rel.sourceColumnId === relationship.sourceColumnId &&
      rel.targetTableId === relationship.targetTableId &&
      rel.targetColumnId === relationship.targetColumnId
    );
    
    if (existingRelationship) {
      console.warn('Relationship already exists:', existingRelationship);
      return;
    }
    
    const newRelationship: Relationship = {
      ...relationship,
      id: uuidv4(),
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      relationships: [...prev.relationships, newRelationship],
      updatedAt: new Date(),
    }));

    // Create foreign key constraint in SQL engine
    if (sqlEngine) {
      try {
        // Create the foreign key constraint
        const fkSQL = `ALTER TABLE ${sourceTable.name} ADD CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name} FOREIGN KEY (${sourceColumn.name}) REFERENCES ${targetTable.name}(${targetColumn.name})`;
        sqlEngine.run(fkSQL);
        console.log('Created foreign key constraint:', fkSQL);
      } catch (error) {
        console.error('Failed to create foreign key constraint in SQL engine:', error);
      }
    }
  }, [currentSchema.tables, currentSchema.relationships, sqlEngine]);

  const removeRelationship = useCallback((relationshipId: string) => {
    // Find the relationship before removing it
    const relationship = currentSchema.relationships.find(r => r.id === relationshipId);
    
    setCurrentSchema(prev => ({
      ...prev,
      relationships: prev.relationships.filter(rel => rel.id !== relationshipId),
      updatedAt: new Date(),
    }));

    // Remove foreign key constraint from SQL engine
    if (sqlEngine && relationship) {
      try {
        const sourceTable = currentSchema.tables.find(t => t.id === relationship.sourceTableId);
        const sourceColumn = sourceTable?.columns.find(c => c.id === relationship.sourceColumnId);
        
        if (sourceTable && sourceColumn) {
          const dropFkSQL = `ALTER TABLE ${sourceTable.name} DROP CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name}`;
          sqlEngine.run(dropFkSQL);
          console.log('Dropped foreign key constraint:', dropFkSQL);
        }
      } catch (error) {
        console.error('Failed to drop foreign key constraint from SQL engine:', error);
      }
    }
  }, [currentSchema.tables, currentSchema.relationships, sqlEngine]);

  const addIndex = useCallback((index: Omit<Index, 'id'>) => {
    const newIndex: Index = {
      ...index,
      id: uuidv4(),
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      indexes: [...prev.indexes, newIndex],
      updatedAt: new Date(),
    }));
  }, []);

  const removeIndex = useCallback((indexId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      indexes: prev.indexes.filter(idx => idx.id !== indexId),
      updatedAt: new Date(),
    }));
  }, []);

  const addConstraint = useCallback((constraint: Omit<Constraint, 'id'>) => {
    const newConstraint: Constraint = {
      ...constraint,
      id: uuidv4(),
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      constraints: [...prev.constraints, newConstraint],
      updatedAt: new Date(),
    }));
  }, []);

  const removeConstraint = useCallback((constraintId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      constraints: prev.constraints.filter(con => con.id !== constraintId),
      updatedAt: new Date(),
    }));
  }, []);

  const addUser = useCallback((user: Omit<User, 'id'>) => {
    const newUser: User = {
      ...user,
      id: uuidv4(),
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      users: [...prev.users, newUser],
      updatedAt: new Date(),
    }));
  }, []);

  const removeUser = useCallback((userId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      users: prev.users.filter(user => user.id !== userId),
      permissions: prev.permissions.filter(perm => perm.userId !== userId),
      updatedAt: new Date(),
    }));
  }, []);

  const grantPermission = useCallback((permission: Omit<Permission, 'id'>) => {
    const newPermission: Permission = {
      ...permission,
      id: uuidv4(),
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      permissions: [...prev.permissions, newPermission],
      updatedAt: new Date(),
    }));
  }, []);

  const revokePermission = useCallback((permissionId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      permissions: prev.permissions.filter(perm => perm.id !== permissionId),
      updatedAt: new Date(),
    }));
  }, []);

  const executeVisualQuery = useCallback(async (query: any) => {
    if (!sqlEngine) return { columns: [], values: [] };

    try {
      // Build SQL from visual query
      let sql = 'SELECT ';
      sql += query.columns.length > 0 ? query.columns.join(', ') : '*';
      sql += ` FROM ${query.tables.join(', ')}`;
      
      if (query.joins && query.joins.length > 0) {
        query.joins.forEach((join: any) => {
          sql += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
        });
      }
      
      if (query.filters && query.filters.length > 0) {
        sql += ' WHERE ' + query.filters.map((f: any) => `${f.column} ${f.operator} '${f.value}'`).join(' AND ');
      }
      
      if (query.groupBy && query.groupBy.length > 0) {
        sql += ` GROUP BY ${query.groupBy.join(', ')}`;
      }
      
      if (query.orderBy && query.orderBy.length > 0) {
        sql += ` ORDER BY ${query.orderBy.map((o: any) => `${o.column} ${o.direction}`).join(', ')}`;
      }

      const result = sqlEngine.exec(sql);
      return result.length > 0 ? result[0] : { columns: [], values: [] };
    } catch (e) {
      const error = e as Error
      console.error('Query execution failed:', error);
      return { columns: [], values: [], error: error.message };
    }
  }, [sqlEngine]);

  const executeSQL = useCallback(async (sql: string) => {
    if (!sqlEngine) return { columns: [], values: [] };

    try {
      const result = sqlEngine.exec(sql);
      return result.length > 0 ? result[0] : { columns: [], values: [] };
    } catch (e) {
      const error = e as Error;
      console.error('SQL execution failed:', error);
      throw new Error(error.message);
    }
  }, [sqlEngine]);

  const saveQuery = useCallback((query: Omit<SavedQuery, 'id' | 'createdAt'>) => {
    const newQuery: SavedQuery = {
      ...query,
      id: uuidv4(),
      createdAt: new Date(),
    };
    
    setCurrentSchema(prev => ({
      ...prev,
      savedQueries: [...prev.savedQueries, newQuery],
      updatedAt: new Date(),
    }));
  }, []);

  const removeQuery = useCallback((queryId: string) => {
    setCurrentSchema(prev => ({
      ...prev,
      savedQueries: prev.savedQueries.filter(q => q.id !== queryId),
      updatedAt: new Date(),
    }));
  }, []);

  const exportSchema = useCallback((format: string) => {
    const { tables, relationships, indexes, constraints, users, permissions } = currentSchema;
    
    let script = '';
    
    switch (format.toLowerCase()) {
      case 'mysql':
        script = generateMySQLScript(tables, relationships, indexes, constraints, users, permissions);
        break;
      case 'postgresql':
        script = generatePostgreSQLScript(tables, relationships, indexes, constraints, users, permissions);
        break;
      case 'sqlserver':
        script = generateSQLServerScript(tables, relationships, indexes, constraints, users, permissions);
        break;
      case 'oracle':
        script = generateOracleScript(tables, relationships, indexes, constraints, users, permissions);
        break;
      case 'mongodb':
        script = generateMongoDBScript(tables);
        break;
      default:
        script = generateMySQLScript(tables, relationships, indexes, constraints, users, permissions);
    }
    
    return script;
  }, [currentSchema]);

  const generateSQL = useCallback(() => {
    return exportSchema('mysql');
  }, [exportSchema]);

  const createNewSchema = useCallback(async (name: string) => {
    // Validate schema name
    const trimmedName = name.trim();
    if (!trimmedName) {
      console.error('Schema name cannot be empty');
      throw new Error('Schema name cannot be empty');
    }
    
    // Validate schema name format (alphanumeric, underscore, hyphen)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(trimmedName)) {
      console.error('Schema name can only contain letters, numbers, underscores, and hyphens');
      throw new Error('Schema name can only contain letters, numbers, underscores, and hyphens');
    }
    
    // Check for duplicate schema names locally (case-insensitive)
    const existingLocalSchema = schemas.find(s => 
      s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (existingLocalSchema) {
      console.error(`Schema with name "${trimmedName}" already exists locally`);
      throw new Error(`Schema with name "${trimmedName}" already exists`);
    }
    
    // Check if database exists in MongoDB
    try {
      const { exists, error } = await mongoService.checkDatabaseExists(trimmedName);
      
      if (error) {
        console.error('Error checking database existence:', error);
        throw new Error(`Failed to check database: ${error}`);
      }
      
      if (exists) {
        console.error(`Database "${trimmedName}" already exists in MongoDB`);
        throw new Error(`Database "${trimmedName}" already exists`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to check database existence');
    }
    
    const newSchema: Schema = {
      id: uuidv4(),
      name: trimmedName,
      tables: [],
      relationships: [],
      indexes: [],
      constraints: [],
      users: [],
      permissions: [],
      savedQueries: [],
      // Enhanced team collaboration fields with default owner
      members: [
        {
          id: uuidv4(),
          username: 'current_user', // In real app, get from auth context
          role: 'owner',
          joinedAt: new Date()
        }
      ],
      invitations: [],
      isShared: false,
      ownerId: 'current_user', // In real app, get from auth context
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setCurrentSchema(newSchema);
    setSchemas(prev => [...prev, newSchema]);
  }, [schemas]);

  const loadSchema = useCallback((schemaId: string) => {
    const schema = schemas.find(s => s.id === schemaId);
    if (schema) {
      setCurrentSchema(schema);
    }
  }, [schemas]);

  const saveSchema = useCallback(() => {
    setSchemas(prev => {
      const existingIndex = prev.findIndex(s => s.id === currentSchema.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = currentSchema;
        return updated;
      }
      return [...prev, currentSchema];
    });
    
  },
 
  [currentSchema]);

  const value: DatabaseContextType = {
    currentSchema,
    schemas,
    sqlEngine,
    importSchema,
    addTable,
    removeTable,
    updateTable,
    alterTable,
    duplicateTable,
    
    insertRow,
    updateRow,
    deleteRow,
    truncateTable,
    addRelationship,
    removeRelationship,
    addIndex,
    removeIndex,
    addConstraint,
    removeConstraint,
    addUser,
    removeUser,
    grantPermission,
    revokePermission,
    // Enhanced team collaboration functions
    inviteToWorkspace,
    acceptWorkspaceInvitation,
    removeWorkspaceMember,
    validateUsername,
    syncWorkspaceWithMongoDB,
    loadSharedSchemas,
    syncSchemaToWorkspace,
    executeVisualQuery,
    executeSQL,
    saveQuery,
    removeQuery,
    exportSchema,
    createNewSchema,
    loadSchema,
    saveSchema,
    generateSQL,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

// SQL generation functions (keeping existing implementations)
function generateMySQLScript(tables: Table[], relationships: Relationship[], indexes: Index[], _constraints: Constraint[], users: User[], permissions: Permission[]): string {
  let script = '-- MySQL Database Schema\n-- Generated by Database Creator\n\n';
  
  // Create tables
  tables.forEach(table => {
    script += `CREATE TABLE \`${table.name}\` (\n`;
    const columnDefs = table.columns.map(col => {
      let def = `  \`${col.name}\` ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
      if (col.isPrimaryKey) def += ' PRIMARY KEY';
      if (col.isUnique) def += ' UNIQUE';
      return def;
    });
    script += columnDefs.join(',\n') + '\n';
    script += ');\n\n';
  });
  
  // Create indexes
  indexes.forEach(index => {
    const table = tables.find(t => t.id === index.tableId);
    if (table) {
      const uniqueStr = index.isUnique ? 'UNIQUE ' : '';
      script += `CREATE ${uniqueStr}INDEX \`${index.name}\` ON \`${table.name}\` (${index.columns.map(c => `\`${c}\``).join(', ')});\n`;
    }
  });
  
  if (indexes.length > 0) script += '\n';
  
  // Create foreign keys
  relationships.forEach(rel => {
    const sourceTable = tables.find(t => t.id === rel.sourceTableId);
    const targetTable = tables.find(t => t.id === rel.targetTableId);
    const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
    const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);
    
    console.log('Exporting relationship:', {
      rel,
      sourceTable: sourceTable?.name,
      targetTable: targetTable?.name,
      sourceColumn: sourceColumn?.name,
      targetColumn: targetColumn?.name,
      sourceTableId: rel.sourceTableId,
      targetTableId: rel.targetTableId,
      sourceColumnId: rel.sourceColumnId,
      targetColumnId: rel.targetColumnId
    });
    
    if (sourceTable && targetTable && sourceColumn && targetColumn) {
      script += `ALTER TABLE \`${sourceTable.name}\` ADD CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name} FOREIGN KEY (\`${sourceColumn.name}\`) REFERENCES \`${targetTable.name}\`(\`${targetColumn.name}\`);\n`;
    } else {
      console.error('Failed to resolve relationship:', {
        sourceTable: sourceTable?.name || 'NOT FOUND',
        targetTable: targetTable?.name || 'NOT FOUND',
        sourceColumn: sourceColumn?.name || 'NOT FOUND',
        targetColumn: targetColumn?.name || 'NOT FOUND'
      });
    }
  });
  
  if (relationships.length > 0) script += '\n';
  
  // Create users and permissions
  users.forEach(user => {
    script += `CREATE USER '${user.name}'@'localhost';\n`;
  });
  
  permissions.forEach(perm => {
    const user = users.find(u => u.id === perm.userId);
    const table = tables.find(t => t.id === perm.tableId);
    if (user && table) {
      const perms = perm.permissions.join(', ');
      script += `GRANT ${perms} ON \`${table.name}\` TO '${user.name}'@'localhost';\n`;
    }
  });
  
  return script;
}

function generatePostgreSQLScript(tables: Table[], relationships: Relationship[], _indexes: Index[], _constraints: Constraint[], _users: User[], _permissions: Permission[]): string {
  let script = '-- PostgreSQL Database Schema\n-- Generated by Database Creator\n\n';
  
  tables.forEach(table => {
    script += `CREATE TABLE "${table.name}" (\n`;
    const columnDefs = table.columns.map(col => {
      let def = `  "${col.name}" ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
      if (col.isPrimaryKey) def += ' PRIMARY KEY';
      if (col.isUnique) def += ' UNIQUE';
      return def;
    });
    script += columnDefs.join(',\n') + '\n';
    script += ');\n\n';
  });
  
  // Create foreign keys
  relationships.forEach(rel => {
    const sourceTable = tables.find(t => t.id === rel.sourceTableId);
    const targetTable = tables.find(t => t.id === rel.targetTableId);
    const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
    const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);
    
    console.log('Exporting PostgreSQL relationship:', {
      rel,
      sourceTable: sourceTable?.name,
      targetTable: targetTable?.name,
      sourceColumn: sourceColumn?.name,
      targetColumn: targetColumn?.name
    });
    
    if (sourceTable && targetTable && sourceColumn && targetColumn) {
      script += `ALTER TABLE "${sourceTable.name}" ADD CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name} FOREIGN KEY ("${sourceColumn.name}") REFERENCES "${targetTable.name}"("${targetColumn.name}");\n`;
    } else {
      console.error('Failed to resolve PostgreSQL relationship:', {
        sourceTable: sourceTable?.name || 'NOT FOUND',
        targetTable: targetTable?.name || 'NOT FOUND',
        sourceColumn: sourceColumn?.name || 'NOT FOUND',
        targetColumn: targetColumn?.name || 'NOT FOUND'
      });
    }
  });
  
  if (relationships.length > 0) script += '\n';
  
  return script;
}

function generateSQLServerScript(tables: Table[], relationships: Relationship[], _indexes: Index[], _constraints: Constraint[], _users: User[], _permissions: Permission[]): string {
  let script = '-- SQL Server Database Schema\n-- Generated by Database Creator\n\n';
  
  tables.forEach(table => {
    script += `CREATE TABLE [${table.name}] (\n`;
    const columnDefs = table.columns.map(col => {
      let def = `  [${col.name}] ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
      if (col.isPrimaryKey) def += ' PRIMARY KEY';
      if (col.isUnique) def += ' UNIQUE';
      return def;
    });
    script += columnDefs.join(',\n') + '\n';
    script += ');\n\n';
  });
  
  // Create foreign keys
  relationships.forEach(rel => {
    const sourceTable = tables.find(t => t.id === rel.sourceTableId);
    const targetTable = tables.find(t => t.id === rel.targetTableId);
    const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
    const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);
    
    if (sourceTable && targetTable && sourceColumn && targetColumn) {
      script += `ALTER TABLE [${sourceTable.name}] ADD CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name} FOREIGN KEY ([${sourceColumn.name}]) REFERENCES [${targetTable.name}]([${targetColumn.name}]);\n`;
    }
  });
  
  if (relationships.length > 0) script += '\n';
  
  return script;
}

function generateOracleScript(tables: Table[], relationships: Relationship[], _indexes: Index[], _constraints: Constraint[], _users: User[], _permissions: Permission[]): string {
  let script = '-- Oracle Database Schema\n-- Generated by Database Creator\n\n';
  
  tables.forEach(table => {
    script += `CREATE TABLE ${table.name} (\n`;
    const columnDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
      return def;
    });
    script += columnDefs.join(',\n') + '\n';
    script += ');\n\n';
  });
  
  // Create foreign keys
  relationships.forEach(rel => {
    const sourceTable = tables.find(t => t.id === rel.sourceTableId);
    const targetTable = tables.find(t => t.id === rel.targetTableId);
    const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
    const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);
    
    if (sourceTable && targetTable && sourceColumn && targetColumn) {
      script += `ALTER TABLE ${sourceTable.name} ADD CONSTRAINT fk_${sourceTable.name}_${sourceColumn.name} FOREIGN KEY (${sourceColumn.name}) REFERENCES ${targetTable.name}(${targetColumn.name});\n`;
    }
  });
  
  if (relationships.length > 0) script += '\n';
  
  return script;
}

function generateMongoDBScript(tables: Table[]): string {
  let script = '// MongoDB Collection Schema\n// Generated by Database Creator\n\n';

  tables.forEach(table => {
    script += `// Collection: ${table.name}\n`;
    script += `db.createCollection("${table.name}");\n\n`;

    // 1) MongoDB sxeminin tipini müəyyən edin
    interface MongoSchema {
      $jsonSchema: {
        bsonType: string;
        required: string[];
        properties: Record<string, { bsonType: string; description: string }>;
      };
    }

    // 2) Obyekti bu tipdə elan edin
    const schema: MongoSchema = {
      $jsonSchema: {
        bsonType: "object",
        required: table.columns.filter(col => !col.nullable).map(col => col.name),
        properties: {}  // indi Record<string, …> kimi tanınır
      }
    };

    // 3) Xüsusiyyətləri əlavə edin
    table.columns.forEach(col => {
      schema.$jsonSchema.properties[col.name] = {
        bsonType: col.type === 'INT' ? 'int' : 'string',
        description: `${col.name} field`
      };
    });

    script += `db.runCommand({\n`;
    script += `  collMod: "${table.name}",\n`;
    script += `  validator: ${JSON.stringify(schema, null, 2)}\n`;
    script += `});\n\n`;
  });

  return script;
}
