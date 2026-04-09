import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000
    });
  }

  setAuthToken(token: string, userId: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    this.client.defaults.headers.common['x-user-id'] = userId;
  }

  clearAuth(): void {
    delete this.client.defaults.headers.common['Authorization'];
    delete this.client.defaults.headers.common['x-user-id'];
  }

  // Conversation endpoints
  async getConversations() {
    const response = await this.client.get('/conversations');
    return response.data;
  }

  async createConversation(title: string) {
    const response = await this.client.post('/conversations', { title });
    return response.data;
  }

  async getConversation(id: string) {
    const response = await this.client.get(`/conversations/${id}`);
    return response.data;
  }

  async deleteConversation(id: string) {
    const response = await this.client.delete(`/conversations/${id}`);
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export default new ApiClient();
