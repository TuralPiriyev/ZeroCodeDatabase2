// src/utils/api.ts
import axios from 'axios';
import config from '../config/environment';
export const api = axios.create({
  baseURL: config.API_BASE_URL,
  withCredentials: true
});
// Load base URL from env or use current origin + /api
const envUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const originUrl = typeof window !== 'undefined'
  ? window.location.origin.replace(/\/$/, '')
  : '';
axios.defaults.baseURL = envUrl || `${originUrl}/api`;
axios.defaults.withCredentials = true;

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:');
  console.log(`📡 Base URL: ${axios.defaults.baseURL}`);
  console.log(`🍪 With Credentials: ${axios.defaults.withCredentials}`);
}

// Attach token on each request
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Remove automatic redirect on 401; let components handle it
axios.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
);

export default axios;
