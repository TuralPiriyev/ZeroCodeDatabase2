import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Table, Column, Position, Relationship, DataType } from '../types';

interface TableContextType {
  tables: Table[];
  relationships: Relationship[];
  addTable: (name: string, columns: Omit<Column, 'id'>[]) => void;
  updateTable: (tableId: string, name: string, columns: Column[]) => void;
  deleteTable: (tableId: string) => void;
  updateTablePosition: (tableId: string, position: Position) => void;
  getColumnById: (tableId: string, columnId: string) => Column | undefined;
  getTableById: (tableId: string) => Table | undefined;
}

const TableContext = createContext<TableContextType>({
  tables: [],
  relationships: [],
  addTable: () => {},
  updateTable: () => {},
  deleteTable: () => {},
  updateTablePosition: () => {},
  getColumnById: () => undefined,
  getTableById: () => undefined,
});

export const useTableContext = () => useContext(TableContext);

export const TableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  const addTable = useCallback((name: string, columnsData: Omit<Column, 'id'>[]) => {
    const columns = columnsData.map(col => ({
      ...col,
      id: uuidv4(),
    }));

    const newTable: Table = {
      id: uuidv4(),
      name,
      position: { x: 100, y: 100 },
      columns,
    };

    setTables(prevTables => [...prevTables, newTable]);
    
    // Create relationships for foreign keys
    const newRelationships = columns
      .filter(col => col.isForeignKey && col.referencedTable && col.referencedColumn)
      .map(col => ({
        id: uuidv4(),
        sourceTableId: newTable.id,
        sourceColumnId: col.id,
        targetTableId: col.referencedTable!,
        targetColumnId: col.referencedColumn!,
      }));

    if (newRelationships.length > 0) {
      setRelationships(prev => [...prev, ...newRelationships]);
    }
  }, []);

  const updateTable = useCallback((tableId: string, name: string, columns: Column[]) => {
    setTables(prevTables => 
      prevTables.map(table => {
        if (table.id === tableId) {
          return { ...table, name, columns };
        }
        return table;
      })
    );

    // Update relationships
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    // Remove old relationships for this table
    setRelationships(prev => prev.filter(rel => rel.sourceTableId !== tableId));

    // Add new relationships
    const newRelationships = columns
      .filter(col => col.isForeignKey && col.referencedTable && col.referencedColumn)
      .map(col => ({
        id: uuidv4(),
        sourceTableId: tableId,
        sourceColumnId: col.id,
        targetTableId: col.referencedTable!,
        targetColumnId: col.referencedColumn!,
      }));

    if (newRelationships.length > 0) {
      setRelationships(prev => [...prev, ...newRelationships]);
    }
  }, [tables]);

  const deleteTable = useCallback((tableId: string) => {
    setTables(prevTables => prevTables.filter(table => table.id !== tableId));
    
    // Delete relationships involving this table
    setRelationships(prev => 
      prev.filter(rel => rel.sourceTableId !== tableId && rel.targetTableId !== tableId)
    );
  }, []);

  const updateTablePosition = useCallback((tableId: string, position: Position) => {
    setTables(prevTables => 
      prevTables.map(table => {
        if (table.id === tableId) {
          return { ...table, position };
        }
        return table;
      })
    );
  }, []);

  const getColumnById = useCallback((tableId: string, columnId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return undefined;
    return table.columns.find(c => c.id === columnId);
  }, [tables]);

  const getTableById = useCallback((tableId: string) => {
    return tables.find(t => t.id === tableId);
  }, [tables]);

  return (
    <TableContext.Provider
      value={{
        tables,
        relationships,
        addTable,
        updateTable,
        deleteTable,
        updateTablePosition,
        getColumnById,
        getTableById,
      }}
    >
      {children}
    </TableContext.Provider>
  );
};