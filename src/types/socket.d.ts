import { Patch } from 'fast-json-patch';

export interface WorkspacePatchedPayload {
  workspaceId: string;
  patches: Patch[];
  version: number;
  originSocketId?: string;
  tempId?: string;
}

export interface WorkspaceUpdatePayload {
  workspaceId: string;
  patches: Patch[];
  clientVersion: number;
  tempId?: string;
}
