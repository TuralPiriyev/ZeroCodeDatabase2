import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { collaborationService } from '../../services/collaborationService';
import type { Operation } from 'fast-json-patch';

interface Props { workspaceId: string; initialDoc: any; token?: string }

export default function CollaborativeEditor({ workspaceId, initialDoc, token }: Props) {
  const { connect, joinWorkspace, sendPatch, on, off } = useWebSocket(token);
  const [doc, setDoc] = useState<any>(initialDoc);
  const [version, setVersion] = useState<number>(initialDoc?.version || 0);
  const pendingRef = useRef<Record<string, boolean>>({});

  useEffect(() => { connect(); joinWorkspace(workspaceId); }, [workspaceId]);

  useEffect(() => {
    const handlePatched = (payload: any) => {
      if (!payload) return;
      if (payload.originSocketId === (window as any).__MY_SOCKET_ID__) return;
      // apply patches
      const newDoc = collaborationService.applyPatchesLocally(doc, payload.patches);
      setDoc(newDoc);
      setVersion(payload.version);
    };
  const handleFull = (payload: any) => { if (payload && payload.doc) { setDoc(payload.doc); setVersion(payload.doc.version || 0); } };
  const handleConflict = (_payload: any) => {
      // request full
      // attempt to fetch full document
      console.warn('Conflict, requesting full');
    };

    on('workspace:patched', handlePatched);
    on('workspace:full', handleFull);
    on('workspace:conflict', handleConflict);
    return () => { off('workspace:patched', handlePatched); off('workspace:full', handleFull); off('workspace:conflict', handleConflict); };
  }, [doc]);

  // naive editor change handler for demo - real app should diff on change
  function onLocalChange(newDoc: any) {
    const patches: Operation[] = collaborationService.createPatches(doc, newDoc) as any;
    if (!patches || patches.length === 0) { setDoc(newDoc); return; }
    const tempId = String(Date.now()) + Math.random().toString(36).slice(2,8);
    // optimistically apply
    const optimistic = collaborationService.applyPatchesLocally(doc, patches);
    setDoc(optimistic);
    // send patches
    sendPatch(workspaceId, patches, version, tempId).then((ack: any) => {
      if (ack && ack.ok) {
        setVersion(ack.version);
        delete pendingRef.current[tempId];
      } else if (ack && ack.status === 'conflict') {
        // request full doc
        console.warn('server conflict, requesting full');
      }
    });
  }

  return (
    <div>
      <h4>Collaborative Editor (demo)</h4>
      <textarea value={JSON.stringify(doc, null, 2)} onChange={e => { try{ const parsed = JSON.parse(e.target.value); onLocalChange(parsed); } catch{} }} style={{width:'100%',height:200}} />
      <div>version: {version}</div>
    </div>
  );
}
