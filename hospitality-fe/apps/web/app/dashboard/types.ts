import React from 'react';

export type Screen =
  | 'dashboard' | 'documents' | 'review' | 'products'
  | 'invoice-matching' | 'recipes' | 'labor' | 'incidents' | 'settings' | 'suppliers' | 'categories' | 'staff-costs';

export type VoiceState = 'idle' | 'listening' | 'streaming' | 'playback';
export type MatchStatus = 'auto-matched' | 'review' | 'confirmed' | 'flagged';
export type KanbanCol = 'open' | 'disputed' | 'resolved';

export interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
  hasPlayback?: boolean;
}

export interface Ingredient {
  name: string;
  supplier: string;
  portion: string;
  unitPrice: string;
  portionCost: number;
  priceChange: number;
}

export interface InvoiceLine {
  id: number;
  rawText: string;
  qty: string;
  unitPrice: string;
  total: string;
  matchedProduct: string | null;
  confidence: number;
  status: MatchStatus;
}

export interface KanbanCard {
  id: number;
  type: 'PRICE_HIKE' | 'LABOR_COST' | 'WASTE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  time: string;
  col: KanbanCol;
}

export interface NavItem {
  id: Screen;
  label: string;
  icon: React.ElementType;
  badge?: number;
}
