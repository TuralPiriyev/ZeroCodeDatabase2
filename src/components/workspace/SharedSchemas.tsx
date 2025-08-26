import React, { useState, useEffect } from 'react';
import { Database, Download, Eye, Clock, AlertCircle, Loader } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { socketService } from '../../services/socketService';

interface SharedSchema {
  schemaId: string;
  name: string;
  scripts: string;
  lastModified: string | Date;
}

interface SharedSchemasProps {
  workspaceId: string;
  onSchemaLoad: (schema: any) => void;
}

const SharedSchemas: React.FC<SharedSchemasProps> = ({ workspaceId, onSchemaLoad }) => {
  const [schemas, setSchemas] = useState<SharedSchema[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSharedSchemas();

    // Listen for real-time schema updates
    const handleDbUpdate = (data: any) => {
      console.log('🔄 Real-time: Database updated:', data);
      loadSharedSchemas(); // Refresh schemas list
    };

    socketService.on('db_update', handleDbUpdate);

    return () => {
      socketService.off('db_update', handleDbUpdate);
    };
  }, [workspaceId]);

  const loadSharedSchemas = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('📂 Loading shared schemas for workspace:', workspaceId);
      const data = await apiService.get(`/workspaces/${workspaceId}`);
      console.log('✅ Workspace data loaded:', data);
      
      if (data.sharedSchemas && Array.isArray(data.sharedSchemas)) {
        setSchemas(data.sharedSchemas);
      } else {
        console.warn('No sharedSchemas in response:', data);
        setSchemas([]);
      }
    } catch (error) {
      console.error('❌ Error loading shared schemas:', error);
      setError(error instanceof Error ? error.message : 'Failed to load shared schemas');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchema = (schema: SharedSchema) => {
    try {
      console.log('📥 Loading schema:', schema.name);
      const schemaData = JSON.parse(schema.scripts);
      onSchemaLoad(schemaData);
      console.log('✅ Schema loaded successfully');
    } catch (error) {
      console.error('❌ Failed to parse schema:', error);
      setError('Failed to load schema. Invalid format.');
    }
  };

  const downloadSchema = (schema: SharedSchema) => {
    try {
      const blob = new Blob([schema.scripts], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Failed to download schema:', error);
    }
  };

  const safeParseDate = (dateValue: string | Date | null | undefined): Date | null => {
    if (!dateValue) return null;
    
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    
    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Shared Database Schemas ({schemas.length})
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Collaborative database designs
            </p>
          </div>
        </div>
        
        <button
          onClick={loadSharedSchemas}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
          title="Refresh schemas"
        >
          <Database className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-red-800 dark:text-red-200 text-sm font-medium">Error</span>
          </div>
          <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          <button
            onClick={loadSharedSchemas}
            className="mt-2 text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-green-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading schemas...</span>
          </div>
        ) : schemas.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No shared schemas yet</p>
            <p className="text-sm text-gray-400">Share your current schema to collaborate with team members</p>
          </div>
        ) : (
          schemas.map((schema, index) => {
            const lastModified = safeParseDate(schema.lastModified);
            
            return (
              <div
                key={`${schema.schemaId}-${index}`}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {schema.name}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>
                        {lastModified 
                          ? `Modified ${lastModified.toLocaleDateString()}`
                          : 'Unknown date'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => loadSchema(schema)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors duration-200"
                    title="Load this schema"
                  >
                    <Eye className="w-4 h-4" />
                    Load
                  </button>
                  
                  <button
                    onClick={() => downloadSchema(schema)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors duration-200"
                    title="Download schema"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SharedSchemas;