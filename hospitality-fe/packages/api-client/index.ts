import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL } from '@hospitality-saas/constants';
import { AuthResponse, Invoice, Recipe, OperationalIncident, StaffMember, AIInsight } from '@hospitality-saas/shared-types';
import { LoginInput } from '@hospitality-saas/validation';

export class ApiClient {
  private instance: AxiosInstance;

  constructor(
    private getAccessToken: () => string | null,
    private setAccessToken: (token: string) => void,
    private getRefreshToken: () => string | null,
    private onUnauthorized: () => void
  ) {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add SuperTokens interceptors to axios instance
    if (typeof window !== 'undefined') {
      try {
        const Session = require('supertokens-web-js/recipe/session').default;
        Session.addAxiosInterceptors(this.instance);
      } catch (e) {
        console.error('Failed to load SuperTokens axios interceptor', e);
      }
    }

    // Simple response interceptor to redirect to login on 401
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // If the request fails with 401 even after SuperTokens tries to refresh,
          // the session is expired or invalid. Trigger logout to clear local state.
          this.onUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(data: LoginInput): Promise<AuthResponse> {
    const res = await this.instance.post<AuthResponse>('/auth/login', data);
    return res.data;
  }

  async getMe(): Promise<any> {
    const res = await this.instance.get<any>('/auth/me');
    return res.data;
  }

  // Invoices & OCR
  async getInvoices(): Promise<Invoice[]> {
    const res = await this.instance.get<Invoice[]>('/invoices');
    return res.data;
  }

  async getInvoiceDetails(id: number): Promise<any> {
    const res = await this.instance.get<any>(`/invoices/${id}`);
    return res.data;
  }

  async updateInvoice(id: number, data: any): Promise<any> {
    const res = await this.instance.put<any>(`/invoices/${id}`, data);
    return res.data;
  }

  async uploadInvoice(formData: FormData): Promise<{ invoiceId: number; invoiceNumber: string | null; supplierName: string | null; totalAmount: number; linesCount: number }> {
    const res = await this.instance.post('/invoices/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }

  async getInvoiceStatus(id: number): Promise<{
    id: number;
    status: string;
    needs_review: boolean;
    invoice_number: string | null;
    supplier_name: string | null;
    total_amount: number | null;
    extraction_method: string | null;
    ocr_confidence: number | null;
  }> {
    const res = await this.instance.get(`/invoices/${id}/status`);
    return res.data;
  }


  // Recipes & Menu
  async getRecipes(): Promise<Recipe[]> {
    const res = await this.instance.get<Recipe[]>('/recipes');
    return res.data;
  }

  // Operational Incidents & Exceptions
  async getIncidents(): Promise<OperationalIncident[]> {
    const res = await this.instance.get<OperationalIncident[]>('/incidents');
    return res.data;
  }

  async updateIncidentStatus(id: string, status: string): Promise<OperationalIncident> {
    const res = await this.instance.patch<OperationalIncident>(`/incidents/${id}`, { status });
    return res.data;
  }

  // Labor & Staff Scheduling
  async getStaff(): Promise<StaffMember[]> {
    const res = await this.instance.get<StaffMember[]>('/labor/staff');
    return res.data;
  }

  // AI-Driven Insights
  async getInsights(): Promise<AIInsight[]> {
    const res = await this.instance.get<AIInsight[]>('/insights');
    return res.data;
  }

  async chatQuery(queryText: string): Promise<{ answer: string }> {
    const res = await this.instance.get<{ answer: string }>('/chat/query', {
      params: { q: queryText },
    });
    return res.data;
  }

  // User Management
  async getUsers(params?: { search?: string; page?: number; limit?: number }): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const res = await this.instance.get<{
      items: any[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>('/users', { params });
    return res.data;
  }

  async createUser(data: any): Promise<any> {
    const res = await this.instance.post<any>('/users', data);
    return res.data;
  }

  async resendInvite(id: number): Promise<any> {
    const res = await this.instance.post<any>(`/users/${id}/resend-invite`);
    return res.data;
  }

  async updateUserStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<any> {
    const res = await this.instance.patch<any>(`/users/${id}/status`, { status });
    return res.data;
  }

  // Restaurant Management
  async getRestaurant(): Promise<any> {
    const res = await this.instance.get<any>('/restaurant');
    return res.data;
  }

  async updateRestaurant(data: any): Promise<any> {
    const res = await this.instance.put<any>('/restaurant', data);
    return res.data;
  }
}
