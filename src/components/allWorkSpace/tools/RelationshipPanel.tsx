import React, { useState } from 'react';
import { Link2, Trash2, Edit3, Plus, ArrowRight } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';

interface RelationshipDisplayItem {
  id: string;
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  cardinality: string;
  createdAt: Date;
}

const RelationshipPanel: React.FC = () => {
  const { currentSchema, 
    addRelationship,
     removeRelationship } = useDatabase();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<string | null>(null);

  // Convert relationships to display format with proper ordering
  const getRelationshipDisplayItems = (): RelationshipDisplayItem[] => {
    return currentSchema.relationships.map(rel => {
      const sourceTable = currentSchema.tables.find(t => t.id === rel.sourceTableId);
      const targetTable = currentSchema.tables.find(t => t.id === rel.targetTableId);
      const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
      const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);

      console.log('Displaying relationship:', {
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

      return {
        id: rel.id,
        constraintName: `fk_${sourceTable?.name}_${sourceColumn?.name}`,
        sourceTable: sourceTable?.name || 'Unknown',
        sourceColumn: sourceColumn?.name || 'Unknown',
        targetTable: targetTable?.name || 'Unknown',
        targetColumn: targetColumn?.name || 'Unknown',
        cardinality: rel.cardinality,
        createdAt: new Date() // In real implementation, this would come from the relationship
      };
    }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); // Preserve creation order
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    if (confirm('Are you sure you want to delete this relationship?')) {
      removeRelationship(relationshipId);
    }
  };

  const relationshipItems = getRelationshipDisplayItems();

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Table Relationships
          </h3>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={currentSchema.tables.length < 2}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Relationship
          </button>
        </div>

        {currentSchema.tables.length < 2 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Need at least 2 tables to create relationships
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Relationships List */}
      <div className="flex-1 overflow-y-auto">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Active Relationships ({relationshipItems.length})
        </h4>
        
        {relationshipItems.length === 0 ? (
          <div className="text-center py-8">
            <Link2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No relationships defined yet
            </p>
            <p className="text-sm text-gray-400">
              Create foreign key relationships between your tables
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {relationshipItems.map((item, index) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded font-mono">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {item.cardinality} Relationship
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingRelationship(item.id)}
                      className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="Edit relationship"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRelationship(item.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Delete relationship"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Relationship Display - Exact Format as Requested */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <div className="font-mono text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {item.constraintName}
                    </span>
                    : {item.sourceTable}({item.sourceColumn}) → {item.targetTable}({item.targetColumn})
                  </div>
                  
                  {/* Visual Arrow Representation */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                      {item.sourceTable}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                    <span className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                      {item.targetTable}
                    </span>
                    <span className="ml-auto text-xs font-medium">
                      {item.cardinality}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relationship Statistics */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {relationshipItems.filter(r => r.cardinality === '1:1').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">One-to-One</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {relationshipItems.filter(r => r.cardinality === '1:N').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">One-to-Many</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {relationshipItems.filter(r => r.cardinality === 'N:M').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Many-to-Many</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelationshipPanel;