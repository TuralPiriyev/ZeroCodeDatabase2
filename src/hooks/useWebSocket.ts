import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
  userId?: string;
  timestamp?: string;
  username?: string;
  schemaId?: string;
  cursor?: {
    userId: string;
    username: string;
    position: { x: number; y: number };
    selection?: any;
    color: string;
    lastSeen: string;
  };
  changeType?: string;
  position?: { x: number; y: number };
}

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
}

interface UseWebSocketOptions {
  url: string;
  protocols?: string | string[];
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
  enableReconnect?: boolean;
}

// WebSocket portu və URL-i düzəltmək
const getWebSocketUrl = (path: string) => {
  // Development zamanı backend server portunu istifadə et
  if (import.meta.env.DEV) {
    return `ws://localhost:5000${path}`;
  }
  
  // Production zamanı eyni hostdan istifadə et
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${path}`;
};

export const useWebSocket = (options: UseWebSocketOptions) => {
  const {
    url: rawUrl,
    protocols,
    onOpen,
    onClose,
    onError,
    onMessage,
    reconnectAttempts = 3,
    reconnectInterval = 5000,
    autoConnect = true,
    enableReconnect = false
  } = options;

  // URL-i düzəlt
  const url = rawUrl.startsWith('ws://') || rawUrl.startsWith('wss://')
    ? rawUrl
    : getWebSocketUrl(rawUrl);

  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    if (import.meta.env.DEV && url.includes('/collaboration/')) {
      console.log('🔧 WebSocket Configuration:');
      console.log(`📡 URL: ${url}`);
      console.log(`🔄 Auto Connect: ${autoConnect}`);
      console.log(`🔁 Reconnect Attempts: ${reconnectAttempts}`);
    }
  }, [url, autoConnect, reconnectAttempts]);

  const connect = useCallback(() => {
    if (state.isConnecting || state.isConnected) return;

    setState((prev: WebSocketState) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const socket = new WebSocket(url, protocols);

      socket.onopen = (event) => {
        console.log('✅ WebSocket connected:', url);
        setState((prev: WebSocketState) => ({
          ...prev,
          socket,
          isConnected: true,
          isConnecting: false,
          error: null
        }));
        reconnectCountRef.current = 0;
        onOpen?.(event);
      };

      socket.onclose = (event) => {
        console.log('❌ WebSocket closed:', event.code, event.reason);
        setState((prev: WebSocketState) => ({
          ...prev,
          socket: null,
          isConnected: false,
          isConnecting: false
        }));

        onClose?.(event);

        if (shouldReconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`🔄 Reconnecting... Attempt ${reconnectCountRef.current}/${reconnectAttempts}`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      socket.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setState((prev: WebSocketState) => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false
        }));
        onError?.(event);
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setState((prev: WebSocketState) => ({ ...prev, lastMessage: message }));
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setState((prev: WebSocketState) => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        isConnecting: false
      }));
    }
  }, [url, protocols, onOpen, onClose, onError, onMessage, reconnectAttempts, reconnectInterval, state.isConnecting, state.isConnected]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (state.socket) {
      state.socket.close();
    }
  }, [state.socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (state.socket && state.isConnected) {
      try {
        state.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    }
    console.warn('WebSocket not connected, message not sent:', message);
    return false;
  }, [state.socket, state.isConnected]);

  const reconnect = useCallback(() => {
    disconnect();
    shouldReconnectRef.current = true;
    reconnectCountRef.current = 0;
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    sendMessage
  };
};

export default useWebSocket;