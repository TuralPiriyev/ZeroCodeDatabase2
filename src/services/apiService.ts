import { config } from '../config/environment';

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = `${config.API_BASE_URL}/api`;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleResponse(response: Response) {
    const contentType = response.headers.get('content-type');
    
    // Check if response is HTML (server error serving index.html)
    if (contentType && contentType.includes('text/html')) {
      const htmlText = await response.text();
      if (htmlText.includes('<!DOCTYPE')) {
        throw new Error(`Server returned HTML instead of JSON. Check API route configuration. Status: ${response.status}`);
      }
    }

    // Try to parse JSON
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`Invalid JSON response from server. Status: ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  }

  async get(endpoint: string) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`GET ${endpoint} failed:`, error);
      throw error;
    }
  }

  async post(endpoint: string, data: any) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`POST ${endpoint} failed:`, error);
      throw error;
    }
  }

  async put(endpoint: string, data: any) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`PUT ${endpoint} failed:`, error);
      throw error;
    }
  }

  async delete(endpoint: string) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`DELETE ${endpoint} failed:`, error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
export default apiService;