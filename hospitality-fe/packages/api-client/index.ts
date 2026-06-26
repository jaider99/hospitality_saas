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
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to attach access token
    this.instance.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          const refreshToken = this.getRefreshToken();
          if (!refreshToken) {
            this.onUnauthorized();
            return Promise.reject(error);
          }

          try {
            // Attempt to fetch new tokens using refresh token
            const res = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });
            
            const newAccessToken = res.data.accessToken;
            this.setAccessToken(newAccessToken);
            
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.instance(originalRequest);
          } catch (refreshError) {
            this.onUnauthorized();
            return Promise.reject(refreshError);
          }
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

  // Invoices & OCR
  async getInvoices(): Promise<Invoice[]> {
    const res = await this.instance.get<Invoice[]>('/invoices');
    return res.data;
  }

  async getInvoiceDetails(id: number): Promise<any> {
    const res = await this.instance.get<any>(`/invoices/${id}`);
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
}
