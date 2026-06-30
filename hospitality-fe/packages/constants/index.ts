export const API_BASE_URL = '/api/v1';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_DATA: 'auth_user_data'
} as const;

export const LABOR_COST_LIMIT_PERCENTAGE = 30; // Alert if labor > 30% of sales
export const COST_SPIKE_WARNING_THRESHOLD_PERCENTAGE = 5; // Alert if ingredient cost increases by 5%+

export const CATEGORIES = {
  PRODUCTS: ['Citrus', 'Spirits', 'Meat', 'Dairy', 'Produce', 'Dry Goods', 'Soft Drinks', 'Packaging'],
  RECIPES: ['Cocktail', 'Prep Batch', 'Menu Item'],
  INCIDENTS: ['price_spike', 'margin_drop', 'inventory_variance', 'excessive_waste', 'short_delivery', 'labor_cost_leakage']
} as const;

export const INCIDENT_SEVERITY_COLORS = {
  low: 'text-blue-500 bg-blue-50 border-blue-100',
  medium: 'text-yellow-500 bg-yellow-50 border-yellow-100',
  high: 'text-orange-500 bg-orange-50 border-orange-100',
  critical: 'text-red-500 bg-red-50 border-red-100'
} as const;

export const INCIDENT_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  disputed: 'Disputed',
  resolved: 'Resolved',
  dismissed: 'Dismissed'
} as const;
