import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  NodeProps,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDatabase } from '../../../context/DatabaseContext';
import TableNode from './TableNode';
import { collaborationService } from '../../../services/collaborationService';

interface DatabaseCanvasProps {
  zoom: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
}

const nodeTypes = {
  table: TableNode as React.ComponentType<NodeProps>,
};

const DatabaseCanvasInner: React.FC<DatabaseCanvasProps> = ({ 
  zoom, 
  pan, 
  onPanChange, 
  onZoomChange 
}) => {
  const { currentSchema, updateTable, addRelationship, syncWorkspaceWithMongoDB } = useDatabase();
  const { setViewport, getViewport } = useReactFlow();

  // Convert database tables to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return currentSchema.tables.map(table => ({
      id: table.id,
      type: 'table',
      position: table.position,
      data: table,
      draggable: true,
    }));
  }, [currentSchema.tables]);

  // Convert database relationships to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return currentSchema.relationships.map(relationship => {
      const sourceTable = currentSchema.tables.find(t => t.id === relationship.sourceTableId);
      const targetTable = currentSchema.tables.find(t => t.id === relationship.targetTableId);
      const sourceColumn = sourceTable?.columns.find(c => c.id === relationship.sourceColumnId);
      const targetColumn = targetTable?.columns.find(c => c.id === relationship.targetColumnId);
      
      console.log('Creating edge for relationship:', {
        relationship,
        sourceTable: sourceTable?.name,
        targetTable: targetTable?.name,
        sourceColumn: sourceColumn?.name,
        targetColumn: targetColumn?.name
      });
      
      return {
        id: relationship.id,
        source: relationship.sourceTableId,
        target: relationship.targetTableId,
        sourceHandle: relationship.sourceColumnId,
        targetHandle: relationship.targetColumnId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3B82F6', strokeWidth: 2 },
        label: `${sourceColumn?.name || '?'} → ${targetColumn?.name || '?'}`,
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
        labelStyle: { fontSize: 12, fontWeight: 600 },
      };
    });
  }, [currentSchema.relationships, currentSchema.tables]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when schema changes
  useEffect(() => {
    const newNodes = currentSchema.tables.map(table => ({
      id: table.id,
      type: 'table',
      position: table.position,
      data: table,
      draggable: true,
    }));
    setNodes(newNodes);
  }, [currentSchema.tables, setNodes]);

  // Update edges when relationships change
  useEffect(() => {
    const newEdges = currentSchema.relationships.map(relationship => {
      const sourceTable = currentSchema.tables.find(t => t.id === relationship.sourceTableId);
      const targetTable = currentSchema.tables.find(t => t.id === relationship.targetTableId);
      const sourceColumn = sourceTable?.columns.find(c => c.id === relationship.sourceColumnId);
      const targetColumn = targetTable?.columns.find(c => c.id === relationship.targetColumnId);
      
      return {
        id: relationship.id,
        source: relationship.sourceTableId,
        target: relationship.targetTableId,
        sourceHandle: relationship.sourceColumnId,
        targetHandle: relationship.targetColumnId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3B82F6', strokeWidth: 2 },
        label: `${sourceColumn?.name || '?'} → ${targetColumn?.name || '?'}`,
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
        labelStyle: { fontSize: 12, fontWeight: 600 },
      };
    });
    setEdges(newEdges);
  }, [currentSchema.relationships, currentSchema.tables, setEdges]);

  // Monitor zoom changes
  useEffect(() => {
    const currentViewport = getViewport();
    const newZoomPercentage = Math.round(currentViewport.zoom * 100);
    if (newZoomPercentage !== zoom) {
      onZoomChange(newZoomPercentage);
    }
  }, [getViewport, onZoomChange, zoom]);

  // Apply external zoom changes
  useEffect(() => {
    const currentViewport = getViewport();
    const targetZoom = zoom / 100;
    if (Math.abs(currentViewport.zoom - targetZoom) > 0.01) {
      setViewport({
        x: currentViewport.x,
        y: currentViewport.y,
        zoom: targetZoom,
      });
    }
  }, [zoom, setViewport, getViewport]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target && params.sourceHandle && params.targetHandle) {
        console.log('Creating relationship with params:', params);
        
        // Validate that the connection is valid
        const sourceTable = currentSchema.tables.find(t => t.id === params.source);
        const targetTable = currentSchema.tables.find(t => t.id === params.target);
        const sourceColumn = sourceTable?.columns.find(c => c.id === params.sourceHandle);
        const targetColumn = targetTable?.columns.find(c => c.id === params.targetHandle);
        
        console.log('Resolved connection:', {
          sourceTable: sourceTable?.name,
          targetTable: targetTable?.name,
          sourceColumn: sourceColumn?.name,
          targetColumn: targetColumn?.name
        });
        
        if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
          console.error('Invalid connection: Missing table or column');
          return;
        }
        
        const newRelationship = {
          sourceTableId: params.source,
          sourceColumnId: params.sourceHandle,
          targetTableId: params.target,
          targetColumnId: params.targetHandle,
          cardinality: '1:N' as const,
        };
        
        // Add relationship locally
        addRelationship(newRelationship);
        
        // Broadcast to other users if collaboration is connected
        if (collaborationService.isConnected) {
          collaborationService.sendSchemaChange({
            type: 'relationship_added',
            data: { relationship: newRelationship },
            userId: 'current_user',
            timestamp: new Date()
          });
        }
      }
    },
    [addRelationship, currentSchema.tables]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const updates = { position: node.position };
      
      // Update table position locally
      updateTable(node.id, updates);
      
      // Broadcast to other users if collaboration is connected
      if (collaborationService.isConnected) {
        collaborationService.sendSchemaChange({
          type: 'table_updated',
          data: { tableId: node.id, updates },
          userId: 'current_user',
          timestamp: new Date()
        });
      }
    },
    [updateTable]
  );

  // Monitor viewport changes
  const onMove = useCallback(
    (_event: any, viewport: any) => {
      const newZoomPercentage = Math.round(viewport.zoom * 100);
      onZoomChange(newZoomPercentage);
      onPanChange({ x: viewport.x, y: viewport.y });
    },
    [onZoomChange, onPanChange]
  );

  // Send cursor updates when mouse moves over canvas
  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // Cursor tracking hələlik deaktiv
      // if (collaborationService.isConnected()) {
      //   const rect = event.currentTarget.getBoundingClientRect();
      //   const x = event.clientX - rect.left;
      //   const y = event.clientY - rect.top;
      //   
      //   collaborationService.sendCursorUpdate({ x, y });
      // }
    },
    []
  );

  return (
    <div className="h-full w-full" onMouseMove={onMouseMove}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onMove={onMove}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: pan.x, y: pan.y, zoom: zoom / 100 }}
        minZoom={0.25}
        maxZoom={2}
        className="bg-gray-50 dark:bg-gray-900"
      >
        <Controls 
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-gray-600 [&>button]:dark:text-gray-400 [&>button:hover]:bg-gray-100 [&>button:hover]:dark:bg-gray-700"
          position="bottom-right"
          showZoom={false}
          showFitView={true}
          showInteractive={false}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="bg-gray-50 dark:bg-gray-900"
          color="#e5e7eb"
        />
      </ReactFlow>
    </div>
  );
};

const DatabaseCanvas: React.FC<DatabaseCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <DatabaseCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default DatabaseCanvas;