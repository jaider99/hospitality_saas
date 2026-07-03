export interface SupplierContact {
  id?: number;
  supplier_id?: number;
  name: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_preference?: string | null;
  is_main_contact: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SupplierContactCreate = Omit<SupplierContact, 'id' | 'supplier_id' | 'created_at' | 'updated_at'>;

export type SupplierContactUpdate = Partial<SupplierContactCreate> & { id?: number };

export interface SupplierNote {
  title: string;
  content: string;
}

export interface Supplier {
  id: number;
  supplier_code?: string | null;
  name: string;
  legal_name: string | null;
  vat_id: string | null;
  address: string | null;
  category_id: string | null;
  accounting_account: string | null;
  sanitary_registration: string | null;
  tags: string[];
  payment_info: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  contact_list: SupplierContact[];
  notes?: SupplierNote[];
}

export interface SupplierCreate {
  name: string;
  supplier_code?: string | null;
  legal_name?: string | null;
  vat_id?: string | null;
  address?: string | null;
  category_id?: string | null;
  accounting_account?: string | null;
  sanitary_registration?: string | null;
  tags?: string[];
  payment_info?: Record<string, any> | null;
  contacts?: SupplierContact[];
  notes?: SupplierNote[];
}

export type SupplierUpdate = Omit<Partial<SupplierCreate>, 'contacts'> & {
  contacts?: SupplierContactUpdate[];
};

// Interfaces for parsing categories.json
export interface SubCategory {
  id: string;
  name: string;
  color: string;
  hasProducts: boolean;
  parentCategoryID: string;
  fontColor: string;
  subcategories: SubCategory[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  hasProducts: boolean;
  subcategories: SubCategory[];
}

export interface CategoriesData {
  categories: Category[];
}
