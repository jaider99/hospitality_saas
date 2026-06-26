export type UserRole = 'owner' | 'gm' | 'chef' | 'accountant';
export type UserStatus = 'pending' | 'active';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  deliveryDays: string;
  minimumOrder: number;
  paymentTerms: string;
  lastOrderDate: string | null;
  totalSpend: number;
}

export interface SuppliedProduct {
  id: string;
  supplierId: string;
  name: string;
  category: string;
  unit: string;
  packSize: number;
  currentCost: number;
  taxRate: number; // VAT %
  location: string; // Bar, Kitchen, Cold Room, etc.
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface ProductCostHistory {
  id: string;
  suppliedProductId: string;
  unitCost: number;
  changePercentage: number;
  invoiceId: string;
  purchasedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: 'Cocktail' | 'Prep Batch' | 'Menu Item';
  portionYield: number;
  sellingPrice: number; // net of tax
  totalCost: number; // sum of ingredients
  portionCost: number; // totalCost / portionYield
  grossMarginPercentage: number;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  suppliedProductId: string;
  quantity: number;
  unit: string;
  currentIngredientCost: number;
}

export type InvoiceStatus = 'uploading' | 'pending_matching' | 'processed' | 'needs_review';

export interface Invoice {
  id: string;
  supplierId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  fileUrl: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: InvoiceStatus;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  suppliedProductId: string | null;
  rawItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  matchConfidence: number;
  matchStatus: 'auto_matched' | 'manually_matched' | 'unmatched';
}

export interface AIInsight {
  id: string;
  type: 'alert' | 'daily_brief' | 'weekly_brief';
  category: 'margin_leak' | 'spend_spike' | 'anomaly';
  summary: string;
  rawData: Record<string, any>;
  createdAt: string;
}

export type IncidentType = 'price_spike' | 'margin_drop' | 'inventory_variance' | 'excessive_waste' | 'short_delivery' | 'labor_cost_leakage';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'in_progress' | 'disputed' | 'resolved' | 'dismissed';

export interface OperationalIncident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  contextData: Record<string, any>;
  resolvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'chef' | 'waiter' | 'bartender' | 'manager';
  payType: 'hourly' | 'fixed';
  payRate: number;
  active: boolean;
  createdAt: string;
}

export interface StaffShift {
  id: string;
  staffMemberId: string;
  shiftStart: string;
  shiftEnd: string;
  totalHours: number;
  calculatedCost: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
