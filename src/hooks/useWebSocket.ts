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
    return `ws://localhost:5000${path}`;
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
