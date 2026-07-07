import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL } from '@hospitality-saas/constants';
import {
  AuthResponse, Invoice, Recipe, OperationalIncident, StaffMember, AIInsight, Category,
  ExpenseCategory, ProductFormat, ProductListRow, ProductManualCreatePayload,
  ProductUpdatePayload, ProductDetail, ReviewQueueItem, Inventory, InventoryItem
} from '@hospitality-saas/shared-types';
import { LoginInput } from '@hospitality-saas/validation';

export class ApiClient {
  private instance: AxiosInstance;

  constructor(
    private getAccessToken: () => string | null,
    private setAccessToken: (token: string) => void,
    private getRefreshToken: () => string | null,
    private onUnauthorized: () => void,
    customBaseUrl?: string
  ) {
    this.instance = axios.create({
      baseURL: customBaseUrl || API_BASE_URL,
      timeout: 60000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to inject Authorization header if access token exists
    this.instance.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

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
        const requestUrl = error.config?.url || '';
        // Don't redirect when the failure is from the refresh endpoint itself
        // (that causes an infinite loop / false positive error on public routes)
        const isRefreshEndpoint = requestUrl.includes('/session/refresh');
        if (error.response?.status === 401 && !isRefreshEndpoint) {
          // If the request fails with 401 even after SuperTokens tries to refresh,
          // the session is expired or invalid. Trigger logout to clear local state.
          this.onUnauthorized();
        }
        console.error('[ApiClient] Request error:', requestUrl, error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  // Generic HTTP methods
  public async get<T = any>(url: string, config?: any): Promise<{ data: T }> {
    return this.instance.get<T>(url, config);
  }

  public async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    return this.instance.post<T>(url, data, config);
  }

  public async put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    return this.instance.put<T>(url, data, config);
  }

  public async delete<T = any>(url: string, config?: any): Promise<{ data: T }> {
    return this.instance.delete<T>(url, config);
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
    const res = await this.instance.postForm('/invoices/upload', formData);
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



  async deleteInvoice(id: number): Promise<void> {
    await this.instance.delete(`/invoices/${id}`);
  }

  async deleteInvoiceLine(invoiceId: number, lineId: number): Promise<void> {
    await this.instance.delete(`/invoices/${invoiceId}/lines/${lineId}`);
  }

  async bulkDeleteInvoices(invoiceIds: number[]): Promise<void> {
    await this.instance.post('/invoices/bulk-delete', { invoice_ids: invoiceIds });
  }

  // Recipes & Menu
  async getRecipes(params?: { preparations?: boolean }): Promise<Recipe[]> {
    const res = await this.instance.get<Recipe[]>('/recipes', { params });
    return res.data;
  }

  async getRecipeTags(): Promise<any[]> {
    const res = await this.instance.get<any[]>('/recipes/tags');
    return res.data;
  }

  async createRecipeTag(name: string, isPreparation: boolean): Promise<any> {
    const res = await this.instance.post<any>('/recipes/tags', { name, isPreparation });
    return res.data;
  }

  async deleteRecipeTag(tagId: string): Promise<void> {
    await this.instance.delete(`/recipes/tags/${tagId}`);
  }

  async uploadRecipeImage(recipeId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.instance.post<any>(`/recipes/${recipeId}/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }

  async getDishes(params?: { preparations?: boolean }): Promise<any[]> {
    const res = await this.instance.get<any[]>('/recipes/dishes', { params });
    return res.data;
  }

  async getRecipeById(recipeId: number): Promise<any> {
    const res = await this.instance.get<any>(`/recipes/${recipeId}`);
    return res.data;
  }

  async getUnlinkedDishes(): Promise<any[]> {
    const res = await this.instance.get<any[]>('/recipes/dishes/unlinked');
    return res.data;
  }

  async getBOM(dishId: string | number): Promise<any> {
    const res = await this.instance.get<any>(`/recipes/dishes/${dishId}/bom`);
    return res.data;
  }

  async createRecipe(data: any): Promise<any> {
    const res = await this.instance.post<any>('/recipes', data);
    return res.data;
  }

  async updateRecipe(recipeId: number, data: any): Promise<any> {
    const res = await this.instance.put<any>(`/recipes/${recipeId}`, data);
    return res.data;
  }

  async deleteRecipe(recipeId: number): Promise<void> {
    await this.instance.delete(`/recipes/${recipeId}`);
  }

  async addIngredient(recipeId: number, data: any): Promise<any> {
    const res = await this.instance.post<any>(`/recipes/${recipeId}/ingredients`, data);
    return res.data;
  }

  async removeIngredient(ingredientId: number): Promise<void> {
    await this.instance.delete(`/recipes/ingredients/${ingredientId}`);
  }

  async searchSuppliedProducts(query?: string): Promise<any[]> {
    const res = await this.instance.get<any[]>('/recipes/supplied-products', { params: { q: query } });
    return res.data;
  }

  async generateFromFile(file: File): Promise<any[]> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.instance.post<any[]>('/recipes/generate-from-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
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

  // Roles & Permissions
  async getRolePermissions(): Promise<any> {
    const res = await this.instance.get<any>('/roles/permissions');
    return res.data;
  }

  async updateRolePermissions(data: any[]): Promise<any> {
    const res = await this.instance.put<any>('/roles/permissions', data);
    return res.data;
  }

  // Payrolls & Staff Costs
  async getStaffPositions(propertyId: number): Promise<any[]> {
    const res = await this.instance.get<any[]>('/payrolls/positions', { params: { property_id: propertyId } });
    return res.data;
  }

  async createStaffPosition(propertyId: number, data: any): Promise<any> {
    const res = await this.instance.post<any>('/payrolls/positions', data, { params: { property_id: propertyId } });
    return res.data;
  }

  async getStaffEmployees(propertyId: number): Promise<any[]> {
    const res = await this.instance.get<any[]>('/payrolls/employees', { params: { property_id: propertyId } });
    return res.data;
  }

  async createStaffEmployee(propertyId: number, data: any): Promise<any> {
    const res = await this.instance.post<any>('/payrolls/employees', data, { params: { property_id: propertyId } });
    return res.data;
  }

  async updateStaffEmployee(propertyId: number, employeeId: number, data: any): Promise<any> {
    const res = await this.instance.put<any>(`/payrolls/employees/${employeeId}`, data, { params: { property_id: propertyId } });
    return res.data;
  }

  async getMonthlyPayrolls(propertyId: number, period?: string): Promise<any[]> {
    const params: any = { property_id: propertyId };
    if (period) params.period = period;
    const res = await this.instance.get<any[]>('/payrolls/monthly', { params });
    return res.data;
  }

  async createMonthlyPayroll(propertyId: number, formData: FormData): Promise<any> {
    const res = await this.instance.postForm<any>('/payrolls/monthly', formData, { params: { property_id: propertyId } });
    return res.data;
  }

  async updateMonthlyPayroll(propertyId: number, payrollId: number, data: any): Promise<any> {
    const res = await this.instance.put<any>(`/payrolls/monthly/${payrollId}`, data, { params: { property_id: propertyId } });
    return res.data;
  }

  async deleteMonthlyPayroll(propertyId: number, payrollId: number): Promise<any> {
    const res = await this.instance.delete<any>(`/payrolls/monthly/${payrollId}`, { params: { property_id: propertyId } });
    return res.data;
  }

  async duplicatePayrolls(propertyId: number, data: { source_period: string, target_period: string, copy_notes: boolean, copy_attachments: boolean }): Promise<any> {
    const res = await this.instance.post<any>('/payrolls/monthly/duplicate', data, { params: { property_id: propertyId } });
    return res.data;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const res = await this.instance.get<Category[]>('/categories');
    return res.data;
  }

  async getCategoryDetails(id: number): Promise<Category> {
    const res = await this.instance.get<Category>(`/categories/${id}`);
    return res.data;
  }

  async createCategory(data: any): Promise<Category> {
    const res = await this.instance.post<Category>('/categories', data);
    return res.data;
  }

  async updateCategory(id: number, data: any): Promise<Category> {
    const res = await this.instance.put<Category>(`/categories/${id}`, data);
    return res.data;
  }

  async deleteCategory(id: number): Promise<void> {
    await this.instance.delete(`/categories/${id}`);
  }

  // ─── Products & Inventory ─────────────────────────────────────────────────

  async getProducts(params?: {
    skip?: number;
    limit?: number;
    name?: string;
    archived?: boolean;
    bookmarked?: boolean;
    category_id?: string;
    supplier_id?: number;
    sort_by?: string;
    order?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    items: ProductListRow[];
    total: number;
    skip: number;
    limit: number;
    pending_review_count?: number;
  }> {
    const res = await this.instance.get('/products', { params });
    return res.data;
  }

  async getProductDetail(productId: string): Promise<ProductDetail> {
    const res = await this.instance.get<ProductDetail>(`/products/${productId}`);
    return res.data;
  }

  async createProduct(data: ProductManualCreatePayload): Promise<ProductDetail> {
    const res = await this.instance.post<ProductDetail>('/products', data);
    return res.data;
  }

  async updateProduct(productId: string, data: ProductUpdatePayload): Promise<ProductDetail> {
    const res = await this.instance.patch<ProductDetail>(`/products/${productId}`, data);
    return res.data;
  }

  async toggleProductBookmark(productId: string): Promise<{ product_id: string; bookmarked: boolean }> {
    const res = await this.instance.patch<{ product_id: string; bookmarked: boolean }>(`/products/${productId}/bookmark`);
    return res.data;
  }

  async archiveProduct(productId: string, archived: boolean = true): Promise<{ product_id: string; archived: boolean }> {
    const res = await this.instance.patch<{ product_id: string; archived: boolean }>(`/products/${productId}/archive`, null, {
      params: { archived }
    });
    return res.data;
  }



  // Review Queue (New Articles Pending Review)
  async getReviewQueue(params?: { skip?: number; limit?: number; name?: string }): Promise<{
    items: ReviewQueueItem[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const res = await this.instance.get('/products/review-queue', { params });
    return res.data;
  }

  async unifyLineWithProduct(lineId: number, productId: string): Promise<{
    status: string;
    line_id: number;
    product_id: string;
    ref_id: string;
  }> {
    const res = await this.instance.post(`/products/review-queue/${lineId}/unify`, { product_id: productId });
    return res.data;
  }

  async markLineNoMatch(lineId: number): Promise<{
    status: string;
    line_id: number;
    product_id: string;
    ref_id: string;
  }> {
    const res = await this.instance.post(`/products/review-queue/${lineId}/no-match`);
    return res.data;
  }

  // Inventories
  async getInventories(params?: { skip?: number; limit?: number }): Promise<Inventory[]> {
    const res = await this.instance.get<Inventory[]>('/inventories', { params });
    return res.data;
  }

  async getInventory(inventoryId: string): Promise<Inventory> {
    const res = await this.instance.get<Inventory>(`/inventories/${inventoryId}`);
    return res.data;
  }

  async createInventory(data: { id: string; name?: string; inventory_date?: string; notes?: string; created_by?: string }): Promise<Inventory> {
    const res = await this.instance.post<Inventory>('/inventories', data);
    return res.data;
  }

  async getInventoryItems(inventoryId: string, params?: { kind?: string; skip?: number; limit?: number }): Promise<{
    items: InventoryItem[];
    total: number;
  }> {
    const res = await this.instance.get<{ items: InventoryItem[]; total: number }>(`/inventories/${inventoryId}/items`, { params });
    return res.data;
  }
}


