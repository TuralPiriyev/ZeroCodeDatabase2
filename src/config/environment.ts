// Environment configuration for API and WebSocket URLs
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'),

  // Full WebSocket URL with path
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5000/ws/portfolio-updates`
    : 'ws://localhost:5000/ws/portfolio-updates'),


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