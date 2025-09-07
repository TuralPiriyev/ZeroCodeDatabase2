// src/services/yjsCollabService.ts
import * as Y from 'yjs';
import { simpleWebSocketService } from './simpleWebSocketService';

// Minimal Yjs client wrapper to connect a Y.Doc to server via socket.io
// Server emits 'yjs-snapshot' (base64) and 'yjs-update' (base64) and expects clients to emit 'yjs-update'

type UpdateHandler = (doc: Y.Doc) => void;

class YjsCollabService {
  private docs: Map<string, Y.Doc> = new Map();
  private handlers: Map<string, UpdateHandler[]> = new Map();
  private lastWorkspaceId: string | null = null;

  constructor() {
    // listen to socket events
    simpleWebSocketService.on('yjs-snapshot', (payload: any) => this.handleSnapshot(payload));
    simpleWebSocketService.on('yjs-update', (payload: any) => this.handleUpdate(payload));
  }

  connect(workspaceId: string) {
    // ensure socket joined to workspace
    simpleWebSocketService.joinWorkspace(workspaceId);
    if (!this.docs.has(workspaceId)) this.docs.set(workspaceId, new Y.Doc());
  this.lastWorkspaceId = workspaceId;
    return this.docs.get(workspaceId)!;
  }

  disconnect(workspaceId: string) {
    const d = this.docs.get(workspaceId);
    if (d) {
      d.destroy();
      this.docs.delete(workspaceId);
    }
  }

  onUpdate(workspaceId: string, handler: UpdateHandler) {
    if (!this.handlers.has(workspaceId)) this.handlers.set(workspaceId, []);
    this.handlers.get(workspaceId)!.push(handler);
  }

  offUpdate(workspaceId: string, handler: UpdateHandler) {
    const list = this.handlers.get(workspaceId) || [];
    const i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  }

  private handleSnapshot(payload: any) {
    try {
      if (!payload) return;
  const workspaceId = payload && typeof payload === 'object' ? (payload.workspaceId || payload.wsId || payload.workspace || payload.id) : null;
  const b64 = typeof payload === 'string' ? payload : (payload.snapshot || payload.state || payload.data || null);
      if (!b64) return;
  // decode base64 to Uint8Array (browser-friendly)
  const binary = atob(b64);
  const len = binary.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
      // apply snapshot to doc
  const wsId = String(workspaceId || this.lastWorkspaceId || '');
  if (!wsId) return;
  const doc = this.docs.get(wsId) || new Y.Doc();
      Y.applyUpdate(doc, u8);
      this.docs.set(wsId, doc);
      const handlers = this.handlers.get(wsId) || [];
      handlers.forEach(h => { try { h(doc); } catch (e) { console.error('yjs handler error', e); } });
    } catch (e) {
      console.error('Failed to handle yjs-snapshot payload', e);
    }
  }

  private handleUpdate(payload: any) {
    try {
      if (!payload) return;
  const wsId = String((payload && typeof payload === 'object') ? (payload.workspaceId || payload.wsId || payload.workspace) : '') || String(this.lastWorkspaceId || '');
  const b64 = typeof payload === 'string' ? payload : (payload.update || payload.data || payload);
  if (!b64) return;
  const binary = atob(b64);
  const len = binary.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
      const doc = this.docs.get(wsId) || new Y.Doc();
      Y.applyUpdate(doc, u8);
      this.docs.set(wsId, doc);
      const handlers = this.handlers.get(wsId) || [];
      handlers.forEach(h => { try { h(doc); } catch (e) { console.error('yjs handler error', e); } });
    } catch (e) {
      console.error('Failed to handle yjs-update payload', e);
    }
  }

  // send local update (Uint8Array or Update) as base64 to server
  sendUpdate(workspaceId: string, update: Uint8Array | ArrayBuffer) {
    try {
      let u8: Uint8Array;
      if (update instanceof Uint8Array) u8 = update;
      else u8 = new Uint8Array(update as ArrayBuffer);
  // encode to base64 (browser-friendly btoa)
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  const b64 = btoa(binary);
  simpleWebSocketService.send('yjs-update', { workspaceId, update: b64 });
    } catch (e) {
      console.error('Failed to send yjs-update', e);
    }
  }

  // helper to get the Y.Doc for a workspace
  getDoc(workspaceId: string) {
    return this.docs.get(workspaceId) || null;
  }
}

export const yjsCollabService = new YjsCollabService();
export default yjsCollabService;
