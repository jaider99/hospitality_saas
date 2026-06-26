export type Screen =
  | 'dashboard'
  | 'documents'
  | 'invoice-matching'
  | 'review'
  | 'products'
  | 'recipes'
  | 'labor'
  | 'incidents'
  | 'settings';

export type ChatMsg = {
  role: 'user' | 'ai';
  text: string;
  hasPlayback?: boolean;
};

export type InvoiceLine = {
  id: number;
  rawText: string;
  qty: string;
  unitPrice: string;
  total: string;
  matchedProduct: string | null;
  confidence: number;
  status: 'auto-matched' | 'review' | 'confirmed' | 'flagged';
};

export type Incident = {
  id: string;
  type: string;
  severity: string;
  message: string;
  time: string;
  status: string;
};

export type StaffMember = {
  id: number;
  name: string;
  role: string;
  rate: number;
  status: string;
  hours: number;
};
