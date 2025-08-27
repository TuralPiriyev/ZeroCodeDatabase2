// src/config/environment.ts
export const config = {
  // API base - VITE_API_BASE_URL olmasa default development/production uyğun olsun
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL
    ?? (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:5000/api'),

  // Socket host (məs: wss://zerocodedb.online) — Vite env override üçün VITE_WS_BASE_HOST
  WS_BASE_HOST: import.meta.env.VITE_WS_BASE_HOST
    ?? (typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
        : 'ws://localhost:5000'),

  // Socket path on server (must exactly match server.cjs path)
  WS_PATH: import.meta.env.VITE_WS_PATH ?? '/ws/portfolio-updates',

  isDevelopment: Boolean(import.meta.env.DEV),
  isProduction: Boolean(import.meta.env.PROD)
};

if (config.isDevelopment) {
  console.log('🔧 Environment Configuration:');
  console.log(`📡 API Base URL: ${config.API_BASE_URL}`);
  console.log(`🔌 WS Host: ${config.WS_BASE_HOST}`);
  console.log(`📁 WS Path: ${config.WS_PATH}`);
}

export default config;
