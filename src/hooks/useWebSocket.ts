import { io, Socket } from 'socket.io-client';
import { useRef, useEffect } from 'react';
import type { Patch } from 'fast-json-patch';

type Handlers = { [k: string]: Function[] };

/**
 * useWebSocket hook - wraps socket.io-client and provides helpers for the
 * workspace JSON-patch protocol described in the repo.
 */
export function useWebSocket(token?: string, url?: string) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Handlers>({});
  const joinedWorkspacesRef = useRef<Set<string>>(new Set());

  function init() {
    if (socketRef.current) return socketRef.current;
    const opts: any = { autoConnect: false };
    if (token) opts.auth = { token };
    const socket = io(url || '/', opts);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WS connected', socket.id);
      // re-join any workspaces after reconnect
      joinedWorkspacesRef.current.forEach(wid => socket.emit('workspace:join', { workspaceId: wid }));
    });

    socket.on('disconnect', (r: any) => { console.log('WS disconnected', r); });

    socket.onAny((event: string, ...args: any[]) => {
      const hs = handlersRef.current[event];
      if (hs && hs.length) hs.forEach(h => { try { h(...args); } catch (e) { console.error(e); } });
    });

    return socket;
  }

  function connect() {
    const s = init();
    s.connect();
  }

  function disconnect() {
    if (!socketRef.current) return;
    try { socketRef.current.disconnect(); } catch (e) { /* ignore */ }
    socketRef.current = null;
  }

  function joinWorkspace(workspaceId: string) {
    if (!socketRef.current) init();
    if (!socketRef.current) return;
    joinedWorkspacesRef.current.add(workspaceId);
    socketRef.current.emit('workspace:join', { workspaceId });
  }

  function leaveWorkspace(workspaceId: string) {
    if (!socketRef.current) return;
    joinedWorkspacesRef.current.delete(workspaceId);
    socketRef.current.emit('workspace:leave', { workspaceId });
  }

  function sendPatch(workspaceId: string, patches: Patch[], clientVersion: number, tempId?: string) {
    return new Promise<any>((resolve) => {
      if (!socketRef.current) return resolve({ ok: false, status: 'disconnected' });
      socketRef.current.emit('workspace:update', { workspaceId, patches, clientVersion, tempId }, (ack: any) => {
        resolve(ack);
      });
    });
  }

  function requestFull(workspaceId: string) {
    return new Promise<any>((resolve) => {
      if (!socketRef.current) return resolve({ ok: false, error: 'disconnected' });
      socketRef.current.emit('workspace:requestFull', { workspaceId }, (res: any) => resolve(res));
    });
  }

  function on(event: string, cb: Function) {
    if (!handlersRef.current[event]) handlersRef.current[event] = [];
    handlersRef.current[event].push(cb);
  }

  function off(event: string, cb?: Function) {
    if (!handlersRef.current[event]) return;
    if (!cb) { handlersRef.current[event] = []; return; }
    const i = handlersRef.current[event].indexOf(cb);
    if (i >= 0) handlersRef.current[event].splice(i, 1);
  }

  useEffect(() => {
    return () => { try { disconnect(); } catch (e) { /* ignore */ } };
  }, []);

  return { connect, disconnect, joinWorkspace, leaveWorkspace, sendPatch, requestFull, on, off, socketRef };
}
import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  payload: unknown;
}

interface WebSocketHook {
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  isConnected: boolean;
}

interface WebSocketState {
  lastMessage: WebSocketMessage | null;
  isConnected: boolean;
}

const getWebSocketUrl = (path: string) => {
  if (import.meta.env.DEV) {
    return `${window.location.origin.replace(/^http/, 'ws')}${path}`;

  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;

  // path həmişə "/" ilə başlamırsa, burda düzəldirik
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  return `${protocol}//${host}${path}`;
};

export function useWebSocket(
  path: string,
  {
    onMessage,
    onError,
    onOpen,
  }: {
    onMessage?: (message: WebSocketMessage) => void;
    onError?: (error: Event | ErrorEvent) => void;
    onOpen?: () => void;
  } = {}
): WebSocketHook {
  const [state, setState] = useState<WebSocketState>({
    lastMessage: null,
    isConnected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const connect = () => {
      const url = getWebSocketUrl(path);
      console.log('🔌 Connecting to WebSocket:', url);
      const socket = new WebSocket(url);

      wsRef.current = socket;

      socket.onopen = () => {
        console.log('✅ WebSocket connected');
        setState((prev) => ({ ...prev, isConnected: true }));
        onOpen?.();
      };

      socket.onmessage = (event) => {
        try {
          const data =
            typeof event.data === "string" ? event.data : "";
          const message: WebSocketMessage = JSON.parse(data);
          setState((prev) => ({ ...prev, lastMessage: message }));
          onMessage?.(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      socket.onerror = (event: Event | ErrorEvent) => {
        console.error('❌ WebSocket error:', event);
        setState((prev) => ({ ...prev, isConnected: false }));
        onError?.(event);
      };

      socket.onclose = () => {
        console.log('⚠️ WebSocket disconnected. Reconnecting...');
        setState((prev) => ({ ...prev, isConnected: false }));
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [path]);

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket is not connected. Message not sent:', message);
    }
  };

  return {
    sendMessage,
    lastMessage: state.lastMessage,
    isConnected: state.isConnected,
  };
}
