import {
  Home, FileText, FileCheck, AlertCircle, Package, Utensils, Users, AlertTriangle, Settings, Truck, Tag
} from 'lucide-react';
import { InvoiceLine, KanbanCard, ChatMsg, NavItem } from './types';

export const spendData = [
  { month: 'Jan', spend: 11200 }, { month: 'Feb', spend: 12800 },
  { month: 'Mar', spend: 10900 }, { month: 'Apr', spend: 13400 },
  { month: 'May', spend: 12100 }, { month: 'Jun', spend: 14823 },
];

export const marginData = [
  { name: 'Negroni', actual: 26.8, target: 28 }, { name: 'Carbonara', actual: 34.1, target: 32 },
  { name: 'Margherita', actual: 29.7, target: 30 }, { name: 'Tiramisu', actual: 31.2, target: 28 },
];

export const documents = [
  { id: 109, supplier: 'Re Pla Tres S.L.', docNum: '109', date: '06/15/2026', uploadDate: '06/18/2026', amount: 160.70, type: 'Invoice', status: 'completed', icon: 'invoice', paymentStatus: 'Pending', userInitials: '@' },
  { id: 2, supplier: 'MAKRO DISTRIBUCION M...', docNum: '0/0(046)0052/(2026)021846', date: '05/11/2026', uploadDate: '06/09/2026', amount: 109.72, type: 'Invoice', status: 'completed', icon: 'invoice', paymentStatus: 'Overdue', userInitials: 'J' },
  { id: 3, supplier: 'Holaluz-clidom S.A.', docNum: 'VTA202600664109', date: '06/01/2026', uploadDate: '06/02/2026', amount: 173.30, type: 'Invoice', status: 'completed', icon: 'invoice', paymentStatus: 'Overdue', userInitials: 'J' },
  { id: 4, supplier: 'La Tienda Del Barman', docNum: 'A26-003376', date: '05/04/2026', uploadDate: '05/11/2026', amount: 109.56, type: 'Delivery Note', status: 'completed', icon: 'delivery', paymentStatus: 'Overdue', userInitials: 'M' },
  { id: 5, supplier: 'Unknown', docNum: '—', date: '06/23/2026', uploadDate: '06/23/2026', amount: null, type: 'Unknown', status: 'processing', icon: 'unknown', paymentStatus: null, userInitials: null },
  { id: 6, supplier: 'Limoncello Spikes', docNum: '1029', date: '06/18/2026', uploadDate: '06/18/2026', amount: 45.20, type: 'Invoice', status: 'flagged', icon: 'invoice', paymentStatus: 'Pending', userInitials: 'R' },
  { id: 7, supplier: 'Olive oil spike', docNum: '9928', date: '06/12/2026', uploadDate: '06/12/2026', amount: 88.00, type: 'Invoice', status: 'flagged', icon: 'invoice', paymentStatus: 'Paid', userInitials: 'A' },
  { id: 8, supplier: 'Incorrect quantity', docNum: '8872', date: '06/10/2026', uploadDate: '06/10/2026', amount: 14.50, type: 'Invoice', status: 'rejected', icon: 'invoice', paymentStatus: null, userInitials: 'S' },
  { id: 9, supplier: 'Damaged shipment', docNum: '7721', date: '06/09/2026', uploadDate: '06/09/2026', amount: 120.00, type: 'Delivery Note', status: 'rejected', icon: 'delivery', paymentStatus: null, userInitials: 'D' },
  { id: 10, supplier: 'Overcharged items', docNum: '6620', date: '06/08/2026', uploadDate: '06/08/2026', amount: 75.30, type: 'Invoice', status: 'rejected', icon: 'invoice', paymentStatus: null, userInitials: 'O' },
  { id: 11, supplier: 'Invalid tax details', docNum: '5519', date: '06/07/2026', uploadDate: '06/07/2026', amount: 210.40, type: 'Invoice', status: 'rejected', icon: 'invoice', paymentStatus: null, userInitials: 'I' }
];

export const reviewItems = [
  { id: 1, type: 'price_alert', severity: 'CRITICAL', title: 'Price anomaly detected', description: "Limoncello Rossi D'asiago quantity is unusually high versus normal purchases.", time: '18 Jun, 15:35', category: 'price anomalies' },
  { id: 2, type: 'product_match', severity: 'HIGH', title: 'Line item needs product match', description: 'GIN XORIGUER 0.70', time: '18 Jun, 15:35', category: 'document items' },
  { id: 3, type: 'product_match', severity: 'HIGH', title: 'Line item needs product match', description: 'Su pedido O2605123D743R de fecha 11-05-26', time: '18 Jun, 15:35', category: 'document items' },
  { id: 4, type: 'price_alert', severity: 'HIGH', title: 'Price spike detected', description: 'Olive oil Arbequina 5L unit price increased 12%.', time: '20 Jun, 09:14', category: 'price anomalies' },
  { id: 5, type: 'product_match', severity: 'MEDIUM', title: 'Supplier catalog entry missing', description: 'RUCULA BABY 100G — no matching product found.', time: '21 Jun, 11:42', category: 'document items' },
];

export const extractedProducts = [
  { item: 'Lima', qty: '0.94 kg', price: '€4.00', total: '€3.76' },
  { item: 'Pomelo', qty: '0.51 kg', price: '€2.50', total: '€1.28' },
  { item: 'Limon', qty: '1.09 kg', price: '€1.99', total: '€2.18' },
  { item: 'Naranja', qty: '1.56 kg', price: '€1.99', total: '€3.11' },
  { item: 'Aceite De Coco', qty: '1', price: '€4.50', total: '€4.50' },
  { item: 'Tomate pera', qty: '0.69 kg', price: '€3.50', total: '€2.40' },
  { item: 'Menta', qty: '1', price: '€0.85', total: '€0.85' },
  { item: 'limon(z)', qty: '3', price: '€7.00', total: '€21.00' },
  { item: 'Rucula', qty: '1', price: '€1.69', total: '€1.69' },
];

export const recipes = [
  { name: 'Classic Negroni', sale: 12.00, costPct: 26.8, target: 28, portionCost: 3.22, status: 'ok' },
  { name: 'Gin & Tonic', sale: 10.00, costPct: 28.4, target: 30, portionCost: 2.84, status: 'ok' },
  { name: 'Spaghetti Carbonara', sale: 18.00, costPct: 34.1, target: 32, portionCost: 6.14, status: 'warning' },
  { name: 'Margherita Pizza', sale: 14.00, costPct: 29.7, target: 30, portionCost: 4.16, status: 'ok' },
  { name: 'Limoncello Risotto', sale: 22.00, costPct: 38.5, target: 33, portionCost: 8.47, status: 'critical' },
  { name: 'Tiramisu', sale: 8.00, costPct: 31.2, target: 28, portionCost: 2.50, status: 'warning' },
  { name: 'Mojito', sale: 11.00, costPct: 24.3, target: 26, portionCost: 2.67, status: 'ok' },
  { name: 'Beef Tagliata', sale: 28.00, costPct: 42.1, target: 35, portionCost: 11.79, status: 'critical' },
];

export const staff = [
  { id: 1, name: 'Marco Rossi', role: 'CHEF', rate: 18.50, status: 'clocked-in', hours: 6.5, pay: 120.25 },
  { id: 2, name: 'Sofia Loren', role: 'WAITER', rate: 13.00, status: 'clocked-in', hours: 4.0, pay: 52.00 },
  { id: 3, name: 'Luis García', role: 'WAITER', rate: 13.00, status: 'clocked-in', hours: 4.0, pay: 52.00 },
  { id: 4, name: 'Anna Schmidt', role: 'MANAGER', rate: 22.00, status: 'clocked-out', hours: 8.0, pay: 176.00 },
  { id: 5, name: 'Pita Havili', role: 'HOST', rate: 13.00, status: 'clocked-in', hours: 3.5, pay: 45.50 },
  { id: 6, name: 'Danielle Morin', role: 'WAITER', rate: 13.00, status: 'clocked-out', hours: 6.0, pay: 78.00 },
];

export const incidentsBaseData = [
  { id: 1, type: 'PRICE_HIKE', severity: 'CRITICAL', message: "Limoncello Rossi D'asiago price spiked 18% above baseline.", createdAt: '18 Jun, 15:35', status: 'OPEN' },
  { id: 2, type: 'LABOR_COST', severity: 'CRITICAL', message: 'Labor ratio 31.4%, exceeding 30% threshold for Tuesday dinner.', createdAt: '17 Jun, 22:00', status: 'OPEN' },
  { id: 3, type: 'PRICE_HIKE', severity: 'HIGH', message: 'Olive oil Arbequina 5L increased 12% from previous invoice.', createdAt: '20 Jun, 09:14', status: 'OPEN' },
  { id: 4, type: 'WASTE', severity: 'MEDIUM', message: 'Waste log: 2.4 kg fresh salmon spoilage logged by Marco Rossi.', createdAt: '21 Jun, 14:20', status: 'OPEN' },
  { id: 5, type: 'PRICE_HIKE', severity: 'HIGH', message: 'San Marzano tomatoes +8% from IL BOCCONCINO DIST.', createdAt: '22 Jun, 10:01', status: 'RESOLVED' },
  { id: 6, type: 'WASTE', severity: 'LOW', message: 'Expired herb bundle discarded — €4.20 loss.', createdAt: '23 Jun, 08:15', status: 'RESOLVED' },
];

export const invoiceLinesInit: InvoiceLine[] = [
  { id: 1, rawText: 'GIN XORIGUER 0.70', qty: '2', unitPrice: '€12.50', total: '€25.00', matchedProduct: 'GIN XORIGUER 70cl', confidence: 92, status: 'auto-matched' },
  { id: 2, rawText: 'LIMON 1KG', qty: '3', unitPrice: '€1.99', total: '€5.97', matchedProduct: 'Limon (Lemon) 1kg', confidence: 88, status: 'auto-matched' },
  { id: 3, rawText: 'LIMONCELLO ROSSI D ASIAGO 0.70', qty: '4', unitPrice: '€14.80', total: '€59.20', matchedProduct: 'Limoncello Rossi', confidence: 64, status: 'review' },
  { id: 4, rawText: 'ACEITE OLIVA ARBEQUINA 5L', qty: '1', unitPrice: '€32.90', total: '€32.90', matchedProduct: 'Olive Oil Arbequina 5L', confidence: 95, status: 'auto-matched' },
  { id: 5, rawText: 'RUCULA BABY 100G', qty: '2', unitPrice: '€1.69', total: '€3.38', matchedProduct: null, confidence: 42, status: 'review' },
  { id: 6, rawText: 'GIN BOMBAY 1L', qty: '1', unitPrice: '€24.50', total: '€24.50', matchedProduct: 'Gin Bombay Sapphire 1L', confidence: 97, status: 'auto-matched' },
];

export const catalogProducts = [
  'GIN XORIGUER 70cl', 'Gin Bombay Sapphire 1L', 'Gin Hendricks 70cl',
  'Limon (Lemon) 1kg', 'Naranja (Orange) 1kg', 'Limoncello Rossi',
  'Limoncello Pallini 70cl', 'Olive Oil Arbequina 5L', 'Olive Oil Virgen 1L',
  'Rucula Baby 100g', 'Rucula Fresca 200g', 'Campari 1L',
];

export const recipeIngredientMap: Record<string, any[]> = {
  'Classic Negroni': [
    { name: 'Campari', supplier: 'Barcelo & Partners', portion: '30ml', unitPrice: '€18.50/L', portionCost: 0.56, priceChange: 0 },
    { name: 'Gin Bombay Sapphire', supplier: 'Olive Grove Imports', portion: '30ml', unitPrice: '€22.00/L', portionCost: 0.66, priceChange: 3.2 },
    { name: 'Martini Rosso', supplier: 'Barcelo & Partners', portion: '30ml', unitPrice: '€8.40/L', portionCost: 0.25, priceChange: 0 },
    { name: 'Orange peel', supplier: 'Fresca Foods Ltd.', portion: '5g', unitPrice: '€1.99/kg', portionCost: 0.01, priceChange: 0 },
  ],
  'Spaghetti Carbonara': [
    { name: 'Spaghetti pasta', supplier: 'IL BOCCONCINO DIST.', portion: '100g', unitPrice: '€2.20/kg', portionCost: 0.22, priceChange: 0 },
    { name: 'Guanciale', supplier: 'IL BOCCONCINO DIST.', portion: '80g', unitPrice: '€18.00/kg', portionCost: 1.44, priceChange: 7.5 },
    { name: 'Pecorino Romano', supplier: 'IL BOCCONCINO DIST.', portion: '30g', unitPrice: '€24.00/kg', portionCost: 0.72, priceChange: 0 },
    { name: 'Egg yolk', supplier: 'Fresca Foods Ltd.', portion: '2 units', unitPrice: '€3.60/doz', portionCost: 0.60, priceChange: 0 },
  ],
  'Limoncello Risotto': [
    { name: 'Arborio rice', supplier: 'IL BOCCONCINO DIST.', portion: '80g', unitPrice: '€4.20/kg', portionCost: 0.34, priceChange: 0 },
    { name: 'Limoncello Rossi', supplier: 'Barcelo & Partners', portion: '40ml', unitPrice: '€22.40/L', portionCost: 0.90, priceChange: 18.2 },
    { name: 'Parmesan 24m', supplier: 'IL BOCCONCINO DIST.', portion: '30g', unitPrice: '€28.00/kg', portionCost: 0.84, priceChange: 0 },
    { name: 'Vegetable stock', supplier: 'Fresca Foods Ltd.', portion: '200ml', unitPrice: '€3.80/L', portionCost: 0.76, priceChange: 6.1 },
  ],
};

export const defaultIngredients = [
  { name: 'Primary ingredient', supplier: 'IL BOCCONCINO DIST.', portion: '150g', unitPrice: '€12.00/kg', portionCost: 1.80, priceChange: 0 },
  { name: 'Secondary ingredient', supplier: 'Fresca Foods Ltd.', portion: '50g', unitPrice: '€8.50/kg', portionCost: 0.43, priceChange: 5.2 },
];

export const kanbanInit: KanbanCard[] = [
  { id: 1, type: 'PRICE_HIKE', severity: 'CRITICAL', message: 'Limoncello Rossi price spiked 18% above baseline.', time: '18 Jun, 15:35', col: 'open' },
  { id: 2, type: 'LABOR_COST', severity: 'CRITICAL', message: 'Labor ratio 31.4%, exceeding 30% threshold on Tuesday dinner.', time: '17 Jun, 22:00', col: 'open' },
  { id: 3, type: 'PRICE_HIKE', severity: 'HIGH', message: 'Olive oil Arbequina 5L increased 12% from previous invoice.', time: '20 Jun, 09:14', col: 'disputed' },
  { id: 4, type: 'WASTE', severity: 'MEDIUM', message: '2.4 kg fresh salmon spoilage logged by Marco Rossi.', time: '21 Jun, 14:20', col: 'open' },
  { id: 5, type: 'PRICE_HIKE', severity: 'HIGH', message: 'San Marzano tomatoes +8% from IL BOCCONCINO DIST.', time: '22 Jun, 10:01', col: 'disputed' },
  { id: 6, type: 'WASTE', severity: 'LOW', message: 'Expired herb bundle discarded — €4.20 loss.', time: '23 Jun, 08:15', col: 'resolved' },
];

export const chatInit: ChatMsg[] = [
  { role: 'ai', text: "Hello! I'm your AI assistant. I can help you analyze supplier costs, recipe margins, and operational insights. What would you like to know?" },
  { role: 'user', text: 'What did I spend on beverage suppliers last week?' },
  { role: 'ai', text: 'Last week you spent €1,247.80 on beverage suppliers. Vendo lo que tengo S.L. accounted for €136.29 across invoices #5865 and #5872. The largest expense was Olive Grove Imports at €1,120.40 for wine and spirits restocking.', hasPlayback: true },
];

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'documents', label: 'Documents', icon: FileText, badge: 1 },
  { id: 'invoice-matching', label: 'OCR Matching', icon: FileCheck },
  { id: 'review', label: 'Review Center', icon: AlertCircle, badge: 28 },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'recipes', label: 'Recipes', icon: Utensils },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'labor', label: 'Staff & Labor', icon: Users },
  { id: 'staff-costs', label: 'Staff costs', icon: Users },
  { id: 'incidents', label: 'Incidents Board', icon: AlertTriangle, badge: 4 },
  { id: 'settings', label: 'Settings', icon: Settings },
];
