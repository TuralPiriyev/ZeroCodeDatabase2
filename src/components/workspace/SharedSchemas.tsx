import React, { useState, useEffect } from 'react';
import { Database, Download, Eye, Clock, AlertCircle, Loader } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useDatabase } from '../../context/DatabaseContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { socketService } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';

interface SharedSchema {
  schemaId: string;
  name: string;
  scripts: string;
  lastModified: string | Date;
}
interface SharedSchemasProps {
  workspaceId: string;
  onSchemaLoad: (schema: any) => void;
  currentUserRole?: 'owner' | 'editor' | 'viewer';
}

const SharedSchemas: React.FC<SharedSchemasProps> = ({ workspaceId, onSchemaLoad, currentUserRole = 'viewer' }) => {
  const [schemas, setSchemas] = useState<SharedSchema[]>([]);
  const { portfolios, loadPortfolios } = usePortfolio();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedSharedSchemaId, setSelectedSharedSchemaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState<string>('Shared Schema');
  const [isCreating, setIsCreating] = useState(false);

  const { currentSchema } = useDatabase();
  const { getCurrentUser } = useAuth();

  useEffect(() => {
    loadSharedSchemas();
    loadPortfolios().catch(e => console.warn('Failed to load portfolios for SharedSchemas', e));
    const handle = () => loadSharedSchemas();
    socketService.on('db_update', handle);
    return () => socketService.off('db_update', handle);
  }, [workspaceId]);

  const loadSharedSchemas = async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await apiService.get(`/workspaces/${workspaceId}`);
      setSchemas(Array.isArray(data.sharedSchemas) ? data.sharedSchemas : []);
      try {
        const currentUser = getCurrentUser();
        const username = currentUser?.username || null; const userId = currentUser?.id || null;
        let owner = false;
        if (data.ownerId) {
          if (typeof data.ownerId === 'object' && (data.ownerId as any).toString) owner = (data.ownerId as any).toString() === userId;
          else owner = data.ownerId === username || data.ownerId === userId;
        }
        setIsOwner(owner || currentUserRole === 'owner');
      } catch (e) { setIsOwner(currentUserRole === 'owner'); }
    } catch (err) {
      console.error('Error loading shared schemas:', err); setError(err instanceof Error ? err.message : 'Failed to load shared schemas');
    } finally { setIsLoading(false); }
  };

  const safeParseDate = (dateValue: string | Date | null | undefined): Date | null => {
    if (!dateValue) return null; if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue; if (typeof dateValue === 'string') { const parsed = new Date(dateValue); return isNaN(parsed.getTime()) ? null : parsed; } return null;
  };

  const loadSchema = (schema: SharedSchema) => {
    try { const schemaData = JSON.parse(schema.scripts); onSchemaLoad(schemaData); } catch (err) { console.error('Failed to parse schema:', err); setError('Failed to load schema. Invalid format.'); }
  };

  const downloadSchema = (schema: SharedSchema) => {
    try { const blob = new Blob([schema.scripts], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch (err) { console.error('Failed to download schema:', err); }
  };

  const replaceWithCurrent = async () => {
    if (!currentSchema) return setError('No current schema loaded to share'); setIsLoading(true);
    try { const payload = { schemaId: (currentSchema as any).id || `${Date.now()}`, name: (currentSchema as any).name || 'Shared Schema', scripts: JSON.stringify(currentSchema) }; await apiService.post(`/workspaces/${workspaceId}/schemas`, payload); await loadSharedSchemas(); } catch (err) { console.error('Failed to replace schema:', err); setError(err instanceof Error ? err.message : 'Failed to replace schema'); } finally { setIsLoading(false); }
  };

  const shareFromPortfolio = async () => {
    if (!selectedPortfolioId) return setError('Please select a portfolio schema to share'); const p = portfolios.find(pt => (pt as any)._id === selectedPortfolioId); if (!p) return setError('Selected portfolio not found'); setIsLoading(true);
    try { const payload = { schemaId: (p as any)._id, name: (p as any).name || `Portfolio ${(p as any)._id}`, scripts: (p as any).scripts }; if (selectedSharedSchemaId) (payload as any).schemaId = selectedSharedSchemaId; await apiService.post(`/workspaces/${workspaceId}/schemas`, payload); setSelectedPortfolioId(null); setSelectedSharedSchemaId(null); await loadSharedSchemas(); } catch (err) { console.error('Failed to share from portfolio:', err); setError(err instanceof Error ? err.message : 'Failed to share from portfolio'); } finally { setIsLoading(false); }
  };

  const createSharedSchema = async () => {
    if (!currentSchema) return setError('No current schema loaded to create'); if (!newSchemaName) return setError('Please provide a name'); setIsCreating(true); setError(null);
    try { const payload = { schemaId: (currentSchema as any).id || `${Date.now()}`, name: newSchemaName, scripts: JSON.stringify(currentSchema) }; await apiService.post(`/workspaces/${workspaceId}/schemas`, payload); setNewSchemaName('Shared Schema'); await loadSharedSchemas(); } catch (err) { console.error('Failed to create shared schema:', err); setError(err instanceof Error ? err.message : 'Failed to create shared schema'); } finally { setIsCreating(false); }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center"><Database className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Shared Database Schemas ({schemas.length})</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Collaborative database designs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <select value={selectedPortfolioId || ''} onChange={e => setSelectedPortfolioId(e.target.value || null)} className="px-3 py-2 border rounded bg-white text-sm">
                <option value="">Select portfolio schema to share</option>
                {portfolios.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <select value={selectedSharedSchemaId || ''} onChange={e => setSelectedSharedSchemaId(e.target.value || null)} className="px-3 py-2 border rounded bg-white text-sm" title="Optional: choose an existing shared schema to replace">
                <option value="">(Optional) Replace existing shared schema</option>
                {schemas.map(s => <option key={s.schemaId} value={s.schemaId}>{s.name}</option>)}
              </select>
              <button onClick={shareFromPortfolio} disabled={isLoading || !selectedPortfolioId} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm">Share from Portfolio</button>
              <button onClick={replaceWithCurrent} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">Replace with Current</button>
            </>
          )}
          <button onClick={loadSharedSchemas} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Refresh</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-red-800 font-medium">Error</span></div>
          <p className="text-red-700 mt-1 text-sm">{error}</p>
          <button onClick={loadSharedSchemas} className="mt-2 text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Retry</button>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader className="w-6 h-6 animate-spin text-green-600" /><span className="ml-2 text-gray-600">Loading schemas...</span></div>
        ) : schemas.length === 0 ? (
          isOwner ? (
            <div className="py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Create a shared schema from current design</label>
                <input value={newSchemaName} onChange={e => setNewSchemaName(e.target.value)} className="w-full px-3 py-2 border rounded bg-white text-sm" placeholder="Schema name" />
              </div>
              <div className="flex gap-2">
                <button onClick={createSharedSchema} disabled={isCreating} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm">{isCreating ? 'Creating...' : 'Create Shared Schema'}</button>
                <button onClick={replaceWithCurrent} disabled={isLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">Replace with Current</button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No shared schemas yet</p>
              <p className="text-sm text-gray-400">Share your current schema to collaborate with team members</p>
            </div>
          )
        ) : (
          schemas.map((schema, index) => {
            const lastModified = safeParseDate(schema.lastModified);
            return (
              <div key={`${schema.schemaId}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center"><Database className="w-5 h-5 text-blue-600" /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{schema.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Clock className="w-3 h-3" /><span>{lastModified ? `Modified ${lastModified.toLocaleDateString()}` : 'Unknown date'}</span></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadSchema(schema)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"><Eye className="w-4 h-4" />Load</button>
                  <button onClick={() => downloadSchema(schema)} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"><Download className="w-4 h-4" /></button>
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