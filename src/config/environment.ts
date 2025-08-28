// src/config/environment.ts
// src/config/environment.ts
export const config = {
  API_BASE_URL: (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'https://zerocodedb.online')).replace(/\/+$/, ''),
  SOCKET_SERVER_BASE: (import.meta.env.VITE_SOCKET_SERVER_BASE || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'https://zerocodedb.online')).replace(/\/+$/, ''),
  SOCKET_PATH: import.meta.env.VITE_SOCKET_PATH || '/ws/portfolio-updates',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
};



if (config.isDevelopment) {
  console.log('🔧 Environment Configuration:');
  console.log(`📡 API Base URL: ${config.API_BASE_URL}`);
  console.log(`🔌 Socket server base: ${config.SOCKET_SERVER_BASE}`);
  console.log(`🔌 Socket path: ${config.SOCKET_PATH}`);
  console.log(`🌍 Environment: Development`);
}

export default config;
