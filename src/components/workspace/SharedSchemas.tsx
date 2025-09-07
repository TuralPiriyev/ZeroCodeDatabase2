import React, { useState, useEffect } from 'react';
import { Database, Download, Eye, Clock, AlertCircle, Loader } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { workspaceService } from '../../services/workspaceService';
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
  const portfolioCtx = usePortfolio();
  const { portfolios, loadPortfolios, startPolling: startPortfolioPolling, stopPolling: stopPortfolioPolling } = portfolioCtx as any;
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
    let mounted = true;
    let joinedHere = false;

    const init = async () => {
      try {
        // Ensure socket is connected and joined to the workspace room so we receive events
        await socketService.connect(workspaceId).catch(() => {});
        try {
          // joinWorkspace is idempotent; track whether we explicitly joined here so cleanup doesn't stomp other joiners
          socketService.joinWorkspace(workspaceId);
          joinedHere = true;
        } catch (e) {}

        if (!mounted) return;
        await loadSharedSchemas();
        await loadPortfolios().catch(e => console.warn('Failed to load portfolios for SharedSchemas', e));
      } catch (e) {
        console.warn('SharedSchemas:init failed', e);
      }
    };

    init();

    const handle = () => { if (mounted) loadSharedSchemas().catch(() => {}); };
    socketService.on('db_update', handle);
    socketService.on('workspace-updated', handle);

    return () => {
      mounted = false;
      try { socketService.off('db_update', handle); } catch (e) {}
      try { socketService.off('workspace-updated', handle); } catch (e) {}
      // Only leave if this component explicitly joined the workspace
      try { if (joinedHere) socketService.leaveWorkspace(); } catch (e) {}
    };
  }, [workspaceId]);

  // Local polling fallback for shared schemas list
  const pollTimerRef = React.useRef<number | null>(null);
  const startSharedPolling = (intervalMs: number = 1000) => {
    try {
      if (pollTimerRef.current) return;
      pollTimerRef.current = window.setInterval(() => {
        loadSharedSchemas().catch(() => {});
      }, intervalMs) as unknown as number;
    } catch (e) { console.warn('startSharedPolling failed', e); }
  };
  const stopSharedPolling = () => {
    try {
      if (pollTimerRef.current) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    } catch (e) { console.warn('stopSharedPolling failed', e); }
  };

  useEffect(() => {
    return () => { stopSharedPolling(); try { stopPortfolioPolling && stopPortfolioPolling(); } catch (e) {} };
  }, []);

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

  const loadSchema = async (schema: SharedSchema) => {
    setIsLoading(true); setError(null);
    try {
      // Request workspace with specific schemaId so server returns the canonical selectedSchema
      const res = await apiService.get(`/workspaces/${workspaceId}?schemaId=${encodeURIComponent(schema.schemaId)}`);
      const selected = (res && res.selectedSchema) ? res.selectedSchema : null;
      if (selected && selected.scripts) {
        try {
          const schemaData = JSON.parse(selected.scripts);
          // use onSchemaLoad which typically calls importSchema in parent; prefer server source
          onSchemaLoad(schemaData);
          // Refresh local list to ensure timestamps and scripts match server
          await loadSharedSchemas();
        } catch (err) {
          console.error('Failed to parse server schema.scripts:', err);
          setError('Failed to load schema from server (invalid format)');
        }
      } else if (schema.scripts) {
        // fallback to the denormalized copy we already have
        try {
          const schemaData = JSON.parse(schema.scripts);
          onSchemaLoad(schemaData);
        } catch (err) {
          console.error('Failed to parse schema:', err);
          setError('Failed to load schema. Invalid format.');
        }
      } else {
        setError('No schema found on server');
      }
    } catch (err) {
      console.error('Failed to fetch shared schema from server:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shared schema');
    } finally {
      setIsLoading(false);
    }
  };

  const saveToShared = async (schema: SharedSchema) => {
    if (!currentSchema) return setError('No current schema loaded to save');
    // Only allow owners/editors to save
    if (!isOwner && currentUserRole === 'viewer') return setError('You do not have permission to save to this shared schema');
    setIsLoading(true); setError(null);
    try {
      const payloadScripts = JSON.stringify(currentSchema);
      // Use workspaceService which will broadcast socket updates to other clients
      const ok = await workspaceService.updateSharedSchema(workspaceId, schema.schemaId, (currentSchema as any).name || schema.name, payloadScripts);
      if (!ok) throw new Error('Failed to save shared schema via workspaceService');
      // Refresh lists immediately so UI shows updated shared schema in portfolios
  await loadSharedSchemas();
  try { await loadPortfolios(); } catch (e) { console.warn('Failed to refresh portfolios after shared save', e); }
  // Start short polling fallback for up to 3s to catch eventual updates if socket missed
  try { startSharedPolling(1000); startPortfolioPolling && startPortfolioPolling(1000); window.setTimeout(() => { stopSharedPolling(); stopPortfolioPolling && stopPortfolioPolling(); }, 3000); } catch (e) {}
    } catch (err) {
      console.error('Failed to save to shared schema:', err);
      setError(err instanceof Error ? err.message : 'Failed to save to shared schema');
    } finally { setIsLoading(false); }
  };

  const downloadSchema = (schema: SharedSchema) => {
    try { const blob = new Blob([schema.scripts], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${schema.name.toLowerCase().replace(/\s+/g, '_')}_schema.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch (err) { console.error('Failed to download schema:', err); }
  };

  const replaceWithCurrent = async () => {
    if (!currentSchema) return setError('No current schema loaded to share'); setIsLoading(true);
    try {
  // Always use authoritative schemaId when replacing; prefer selectedSharedSchemaId if present
  const canonicalId = selectedSharedSchemaId || (currentSchema as any).id || `${Date.now()}`;
  const payloadScripts = JSON.stringify(currentSchema);
  const ok = await workspaceService.updateSharedSchema(workspaceId, canonicalId, (currentSchema as any).name || 'Shared Schema', payloadScripts);
  if (!ok) throw new Error('Failed to replace shared schema via workspaceService');
  await loadSharedSchemas();
  try { await loadPortfolios(); } catch (e) { console.warn('Failed to refresh portfolios after replace', e); }
  try { startSharedPolling(1000); startPortfolioPolling && startPortfolioPolling(1000); window.setTimeout(() => { stopSharedPolling(); stopPortfolioPolling && stopPortfolioPolling(); }, 3000); } catch (e) {}
    } catch (err) {
      console.error('Failed to replace schema:', err);
      setError(err instanceof Error ? err.message : 'Failed to replace schema');
    } finally { setIsLoading(false); }
  };

  const shareFromPortfolio = async () => {
    if (!selectedPortfolioId) return setError('Please select a portfolio schema to share'); const p = portfolios.find(pt => (pt as any)._id === selectedPortfolioId); if (!p) return setError('Selected portfolio not found'); setIsLoading(true);
    try {
      // Use the portfolio id as canonical schemaId so we upsert instead of insert
  const canonicalId = selectedSharedSchemaId || (p as any)._id;
  const payloadScripts = (p as any).scripts;
  const ok = await workspaceService.updateSharedSchema(workspaceId, canonicalId, (p as any).name || `Portfolio ${(p as any)._id}`, payloadScripts);
  if (!ok) throw new Error('Failed to share from portfolio');
      setSelectedPortfolioId(null);
      setSelectedSharedSchemaId(null);
  await loadSharedSchemas();
  try { await loadPortfolios(); } catch (e) { console.warn('Failed to refresh portfolios after shareFromPortfolio', e); }
  try { startSharedPolling(1000); startPortfolioPolling && startPortfolioPolling(1000); window.setTimeout(() => { stopSharedPolling(); stopPortfolioPolling && stopPortfolioPolling(); }, 3000); } catch (e) {}
    } catch (err) {
      console.error('Failed to share from portfolio:', err);
      setError(err instanceof Error ? err.message : 'Failed to share from portfolio');
    } finally { setIsLoading(false); }
  };

  const createSharedSchema = async () => {
    if (!currentSchema) return setError('No current schema loaded to create'); if (!newSchemaName) return setError('Please provide a name'); setIsCreating(true); setError(null);
    try {
      // Creating a new shared schema: generate a canonical id but do not set createNew
  const canonicalId = (currentSchema as any).id || `${Date.now()}`;
  const payloadScripts = JSON.stringify(currentSchema);
  const ok = await workspaceService.updateSharedSchema(workspaceId, canonicalId, newSchemaName, payloadScripts);
  if (!ok) throw new Error('Failed to create shared schema');
      setNewSchemaName('Shared Schema');
  await loadSharedSchemas();
  try { await loadPortfolios(); } catch (e) { console.warn('Failed to refresh portfolios after createSharedSchema', e); }
  try { startSharedPolling(1000); startPortfolioPolling && startPortfolioPolling(1000); window.setTimeout(() => { stopSharedPolling(); stopPortfolioPolling && stopPortfolioPolling(); }, 3000); } catch (e) {}
    } catch (err) {
      console.error('Failed to create shared schema:', err);
      setError(err instanceof Error ? err.message : 'Failed to create shared schema');
    } finally { setIsCreating(false); }
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
                  {(isOwner || currentUserRole === 'owner' || currentUserRole === 'editor') && (
                    <button onClick={() => saveToShared(schema)} disabled={isLoading} title="Save current editor into this shared schema" className="flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm">Save</button>
                  )}
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