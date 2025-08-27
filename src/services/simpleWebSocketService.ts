// Simplified WebSocket Service to prevent connection spam
class SimpleWebSocketService {
  private static instance: SimpleWebSocketService;
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private connectionOptions: Map<string, any> = new Map();
  private lastConnectionAttempt: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 3000; // Increased from 2s to 3s
  private minReconnectInterval = 5000; // Increased from 3s to 5s to prevent spam
  private connectionStabilityTimeout: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): SimpleWebSocketService {
    if (!SimpleWebSocketService.instance) {
      SimpleWebSocketService.instance = new SimpleWebSocketService();
    }
    return SimpleWebSocketService.instance;
  }

  connect(url: string, options: {
    onOpen?: () => void;
    onMessage?: (data: any) => void;
    onClose?: () => void;
    onError?: (error: any) => void;
    enableReconnect?: boolean;
  } = {}): string {
    const urlPath = url.split('/').slice(-2).join('/'); // Get last 2 parts for ID
    const connectionId = `${urlPath}_${Date.now()}`;
    
    // Live server üçün URL düzəltmə
    let finalUrl = url;
    if (!import.meta.env.DEV && !url.startsWith('ws://') && !url.startsWith('wss://')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      finalUrl = `${protocol}//${host}${url}`;
    }
    
    // Enhanced connection throttling
    const lastAttempt = this.lastConnectionAttempt.get(urlPath) || 0;
    const timeSinceLastAttempt = Date.now() - lastAttempt;
    if (timeSinceLastAttempt < this.minReconnectInterval) {
      console.log(`🔒 Throttling connection attempt for ${urlPath}, waiting ${this.minReconnectInterval - timeSinceLastAttempt}ms`);
      throw new Error(`Connection attempt throttled, please wait ${Math.ceil((this.minReconnectInterval - timeSinceLastAttempt) / 1000)} seconds`);
    }
    
    this.lastConnectionAttempt.set(urlPath, Date.now());
    
    // Store options for potential reconnection
    this.connectionOptions.set(connectionId, { url: finalUrl, options });
    
    // Clean up existing connections more thoroughly
    const existingConnections = Array.from(this.connections.entries())
      .filter(([id, socket]) => {
        const idPath = id.split('_')[0];
        return idPath === urlPath;
      });
    
    existingConnections.forEach(([id, socket]) => {
      console.log(`🔌 Cleaning up existing connection: ${id}`);
      this.cleanupConnection(id, socket, true);
    });

    try {
      console.log(`🔗 Creating new WebSocket connection: ${finalUrl}`);
      const socket = new WebSocket(finalUrl);
      let isStable = false;

      // Reset reconnect attempts for new connection
      this.reconnectAttempts.set(connectionId, 0);

      socket.onopen = () => {
        console.log(`✅ WebSocket connected: ${url}`);
        
        // Set connection as stable after a short period
        const stabilityTimeout = setTimeout(() => {
          isStable = true;
          this.reconnectAttempts.set(connectionId, 0);
          console.log(`🔒 Connection ${connectionId} marked as stable`);
        }, 2000); // 2 seconds stability period
        
        this.connectionStabilityTimeout.set(connectionId, stabilityTimeout);
        options.onOpen?.();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 WebSocket message received:`, data.type, data);
          options.onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, event.data);
        }
      };

      socket.onclose = (event) => {
        console.log(`❌ WebSocket closed: ${url} - Code: ${event.code}, Reason: ${event.reason || 'Unknown'}, Clean: ${event.wasClean}, Stable: ${isStable}`);
        
        // Clean up connection
        this.cleanupConnection(connectionId, socket, false);
        options.onClose?.();

        // Enhanced reconnection logic based on connection stability
        const shouldReconnect = this.shouldAttemptReconnect(event.code, event.wasClean, options.enableReconnect, isStable);
        
        if (shouldReconnect) {
          const attempts = this.reconnectAttempts.get(connectionId) || 0;
          
          if (attempts < this.maxReconnectAttempts) {
            this.scheduleReconnection(connectionId, attempts, event.code, isStable);
          } else {
            console.warn(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${url}`);
            this.cleanupConnectionData(connectionId, urlPath);
          }
        } else {
          console.log(`🔌 Not reconnecting - Code: ${event.code}, Clean: ${event.wasClean}, Enabled: ${options.enableReconnect}`);
          this.cleanupConnectionData(connectionId, urlPath);
        }
      };

      socket.onerror = (error) => {
        console.error(`❌ WebSocket error for ${url}:`, error);
        options.onError?.(error);
      };

      this.connections.set(connectionId, socket);
      return connectionId;

    } catch (error) {
      console.error(`Failed to create WebSocket connection to ${url}:`, error);
      this.connectionOptions.delete(connectionId);
      this.lastConnectionAttempt.delete(urlPath);
      throw error;
    }
  }

  private cleanupConnection(connectionId: string, socket: WebSocket, force: boolean = false) {
    // Clean up stability timeout
    const stabilityTimeout = this.connectionStabilityTimeout.get(connectionId);
    if (stabilityTimeout) {
      clearTimeout(stabilityTimeout);
      this.connectionStabilityTimeout.delete(connectionId);
    }

    // Clean up reconnect timeout
    const reconnectTimeout = this.reconnectTimeouts.get(connectionId);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      this.reconnectTimeouts.delete(connectionId);
    }

    // Close socket if necessary
    if (force && socket && 
        (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      try {
        socket.close(1000, 'Replacing with new connection');
      } catch (error) {
        console.warn(`⚠️ Error closing socket ${connectionId}:`, error);
      }
    }

    this.connections.delete(connectionId);
  }

  private cleanupConnectionData(connectionId: string, urlPath: string) {
    this.reconnectAttempts.delete(connectionId);
    this.connectionOptions.delete(connectionId);
    this.lastConnectionAttempt.delete(urlPath);
  }

  private scheduleReconnection(connectionId: string, attempts: number, closeCode: number, wasStable: boolean) {
    let baseDelay = this.baseReconnectDelay;
    
    // Adjust delay based on close code and stability
    if (closeCode === 1005 || closeCode === 1006) {
      // For abnormal closures, use longer delays
      baseDelay = wasStable ? 
        Math.max(8000 + (attempts * 4000), this.baseReconnectDelay) : // Stable connections get moderate delay
        Math.max(15000 + (attempts * 5000), this.baseReconnectDelay); // Unstable connections get longer delay
      console.log(`🔄 Special handling for code ${closeCode}, stable: ${wasStable}, using delay: ${baseDelay}ms`);
    }
    
    // Gentler exponential backoff
    const exponentialDelay = Math.min(baseDelay * Math.pow(1.3, attempts), 60000); // Max 60s delay
    const jitter = Math.random() * 3000; // Up to 3 seconds jitter
    const delay = exponentialDelay + jitter;
    
    console.log(`🔄 Scheduling reconnection attempt ${attempts + 1}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms for close code: ${closeCode}`);
    
    const timeout = setTimeout(() => {
      // Check if we still need to reconnect
      if (this.reconnectAttempts.has(connectionId) && this.connectionOptions.has(connectionId)) {
        this.reconnectAttempts.set(connectionId, attempts + 1);
        console.log(`🔄 Reconnecting to WebSocket (attempt ${attempts + 1})`);
        
        // Get stored options for reconnection
        const storedOptions = this.connectionOptions.get(connectionId);
        if (storedOptions) {
          try {
            // Create new connection with same options but new ID
            this.connect(storedOptions.url, storedOptions.options);
          } catch (reconnectError: any) {
            console.error(`❌ Reconnection attempt ${attempts + 1} failed:`, reconnectError);
            // If reconnection is throttled, schedule another attempt
            if (reconnectError.message.includes('throttled')) {
              const retryDelay = this.minReconnectInterval + 2000;
              console.log(`⏰ Scheduling retry in ${retryDelay}ms due to throttling`);
              setTimeout(() => {
                if (this.connectionOptions.has(connectionId)) {
                  try {
                    this.connect(storedOptions.url, storedOptions.options);
                  } catch (err) {
                    console.error(`❌ Retry after throttling failed:`, err);
                  }
                }
              }, retryDelay);
            }
          }
        }
      }
    }, delay);
    
    this.reconnectTimeouts.set(connectionId, timeout);
  }

  private shouldAttemptReconnect(code: number, wasClean: boolean, enableReconnect?: boolean, wasStable?: boolean): boolean {
    if (!enableReconnect) return false;
    
    // Don't reconnect for clean closures initiated by client
    if (wasClean && (code === 1000 || code === 1001)) return false;
    
    // Don't reconnect for certain server error codes that indicate permanent issues
    if (code === 1002 || code === 1003 || code === 1007 || code === 1008 || code === 1009 || code === 1010 || code === 1011) {
      return false;
    }
    
    // For unstable connections that close abnormally, be more cautious
    if (!wasStable && (code === 1005 || code === 1006)) {
      console.log('⚠️ Unstable connection closed abnormally, will retry with longer delay');
      return true;
    }
    
    // Reconnect for network issues, abnormal closures, and other recoverable errors
    return true;
  }

  disconnect(connectionId: string) {
    const socket = this.connections.get(connectionId);
    if (socket) {
      console.log(`🔌 Disconnecting WebSocket: ${connectionId}`);
      this.cleanupConnection(connectionId, socket, true);
    }

    // Clear connection attempt tracking for this URL path
    const urlPath = connectionId.split('_')[0];
    this.cleanupConnectionData(connectionId, urlPath);
  }

  disconnectAll() {
    console.log('🔌 Disconnecting all WebSocket connections');
    
    // Clean up all connections
    this.connections.forEach((socket, id) => {
      this.cleanupConnection(id, socket, true);
    });
    
    this.connections.clear();
    this.reconnectTimeouts.clear();
    this.reconnectAttempts.clear();
    this.connectionOptions.clear();
    this.lastConnectionAttempt.clear();
    this.connectionStabilityTimeout.clear();
  }

  sendMessage(connectionId: string, message: any) {
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to ${connectionId}:`, error);
      }
    } else {
      const state = socket ? this.getReadyStateString(socket.readyState) : 'NOT_FOUND';
      console.warn(`WebSocket not ready for ${connectionId} (state: ${state}), message not sent:`, {
        messageType: message.type,
        socketExists: !!socket,
        readyState: state
      });
    }
  }

  isConnected(connectionId: string): boolean {
    const socket = this.connections.get(connectionId);
    return socket?.readyState === WebSocket.OPEN;
  }

  private getReadyStateString(state: number): string {
    switch (state) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  // Debug method to get connection info
  getConnectionInfo(): { [key: string]: any } {
    const info: { [key: string]: any } = {};
    this.connections.forEach((socket, id) => {
      info[id] = {
        readyState: this.getReadyStateString(socket.readyState),
        url: socket.url,
        hasReconnectTimeout: this.reconnectTimeouts.has(id),
        reconnectAttempts: this.reconnectAttempts.get(id) || 0,
        hasStoredOptions: this.connectionOptions.has(id),
        hasStabilityTimeout: this.connectionStabilityTimeout.has(id)
      };
    });
    return info;
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();