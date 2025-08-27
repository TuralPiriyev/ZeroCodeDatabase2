// Environment configuration for API and WebSocket URLs
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 
    (typeof window !== 'undefined' ? (window as Window).location.origin : 
     import.meta.env.DEV ? 'http://localhost:5000' : 'https://zerocodedb.online'),
  
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || 
    (typeof window !== 'undefined' 
      ? ((window as Window).location.protocol === 'https:' ? 'wss://' : 'ws://') + (window as Window).location.host
      : import.meta.env.DEV ? 'ws://localhost:5000' : 'wss://zerocodedb.online'),
  
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
};

// Log configuration in development
if (config.isDevelopment) {
  console.log('🔧 Environment Configuration:');
  console.log(`📡 API Base URL: ${config.API_BASE_URL}`);
  console.log(`🔌 WebSocket Base URL: ${config.WS_BASE_URL}`);
  console.log(`🌍 Environment: ${config.isDevelopment ? 'Development' : 'Production'}`);
}

export default config;