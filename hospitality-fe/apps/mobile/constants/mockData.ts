import { InvoiceLine, Incident, StaffMember } from './types';

export const documentsList = [
  { id: '109', supplier: 'Re Pla Tres S.L.', docNum: '109', date: '06/15/2026', uploadDate: '06/18/2026', amount: 160.70, type: 'Invoice', status: 'completed', paymentStatus: 'Pending', userInitials: '@' },
  { id: '2', supplier: 'MAKRO DISTRIBUCION M...', docNum: '0/0(046)0052/(2026)021846', date: '05/11/2026', uploadDate: '06/09/2026', amount: 109.72, type: 'Invoice', status: 'completed', paymentStatus: 'Overdue', userInitials: 'J' },
  { id: '3', supplier: 'Holaluz-clidom S.A.', docNum: 'VTA202600664109', date: '06/01/2026', uploadDate: '06/02/2026', amount: 173.30, type: 'Invoice', status: 'completed', paymentStatus: 'Overdue', userInitials: 'J' },
  { id: '4', supplier: 'La Tienda Del Barman', docNum: 'A26-003376', date: '05/04/2026', uploadDate: '05/11/2026', amount: 109.56, type: 'Delivery Note', status: 'completed', paymentStatus: 'Overdue', userInitials: 'M' },
  { id: '5', supplier: 'Unknown', docNum: '—', date: '06/23/2026', uploadDate: '06/23/2026', amount: null, type: 'Unknown', status: 'processing', paymentStatus: null, userInitials: null },
  { id: '6', supplier: 'Limoncello Spikes', docNum: '1029', date: '06/18/2026', uploadDate: '06/18/2026', amount: 45.20, type: 'Invoice', status: 'flagged', paymentStatus: 'Pending', userInitials: 'R' },
  { id: '7', supplier: 'Olive oil spike', docNum: '9928', date: '06/12/2026', uploadDate: '06/12/2026', amount: 88.00, type: 'Invoice', status: 'flagged', paymentStatus: 'Paid', userInitials: 'A' },
  { id: '8', supplier: 'Incorrect quantity', docNum: '8872', date: '06/10/2026', uploadDate: '06/10/2026', amount: 14.50, type: 'Invoice', status: 'rejected', paymentStatus: null, userInitials: 'S' },
  { id: '9', supplier: 'Damaged shipment', docNum: '7721', date: '06/09/2026', uploadDate: '06/09/2026', amount: 120.00, type: 'Delivery Note', status: 'rejected', paymentStatus: null, userInitials: 'D' },
  { id: '10', supplier: 'Overcharged items', docNum: '6620', date: '06/08/2026', uploadDate: '06/08/2026', amount: 75.30, type: 'Invoice', status: 'rejected', paymentStatus: null, userInitials: 'O' },
  { id: '11', supplier: 'Invalid tax details', docNum: '5519', date: '06/07/2026', uploadDate: '06/07/2026', amount: 210.40, type: 'Invoice', status: 'rejected', paymentStatus: null, userInitials: 'I' }
];

export const recipesList = [
  { name: 'Classic Negroni', sale: 12.00, costPct: 26.8, portionCost: 3.22, status: 'ok', supplier: 'Barcelo & Partners' },
  { name: 'Gin & Tonic', sale: 10.00, costPct: 28.4, portionCost: 2.84, status: 'ok', supplier: 'Olive Grove Imports' },
  { name: 'Spaghetti Carbonara', sale: 18.00, costPct: 34.1, portionCost: 6.14, status: 'warning', supplier: 'IL BOCCONCINO DIST.' },
  { name: 'Limoncello Risotto', sale: 22.00, costPct: 38.5, portionCost: 8.47, status: 'critical', supplier: 'Barcelo & Partners' },
  { name: 'Tiramisu', sale: 8.00, costPct: 31.2, portionCost: 2.50, status: 'warning', supplier: 'Fresca Foods Ltd.' }
];

export const extractedProducts = [
  { item: 'Lima', qty: '0.94 kg', price: '€4.00', total: '€3.76' },
  { item: 'Pomelo', qty: '0.51 kg', price: '€2.50', total: '€1.28' },
  { item: 'Limon', qty: '1.09 kg', price: '€1.99', total: '€2.18' },
  { item: 'Naranja', qty: '1.56 kg', price: '€1.99', total: '€3.11' },
  { item: 'Aceite De Coco', qty: '1', price: '€4.50', total: '€4.50' },
];

export const staff: StaffMember[] = [
  { id: 1, name: 'Marco Rossi', role: 'CHEF', rate: 18.50, status: 'clocked-in', hours: 6.5 },
  { id: 2, name: 'Sofia Loren', role: 'WAITER', rate: 13.00, status: 'clocked-in', hours: 4.0 },
  { id: 3, name: 'Luis García', role: 'WAITER', rate: 13.00, status: 'clocked-in', hours: 4.0 },
  { id: 4, name: 'Anna Schmidt', role: 'MANAGER', rate: 22.00, status: 'clocked-out', hours: 8.0 },
];

export const initialIncidents: Incident[] = [
  { id: '1', type: 'PRICE_HIKE', severity: 'CRITICAL', message: 'Limoncello Rossi D\'asiago price spiked 18% above baseline.', time: '18 Jun, 15:35', status: 'open' },
  { id: '2', type: 'LABOR_COST', severity: 'CRITICAL', message: 'Labor ratio 31.4%, exceeding 30% threshold for Tuesday dinner.', time: '17 Jun, 22:00', status: 'open' },
  { id: '3', type: 'PRICE_HIKE', severity: 'HIGH', message: 'Olive oil Arbequina 5L increased 12% from previous invoice.', time: '20 Jun, 09:14', status: 'disputed' },
  { id: '4', type: 'WASTE', severity: 'MEDIUM', message: '2.4 kg fresh salmon spoilage logged by Marco Rossi.', time: '21 Jun, 14:20', status: 'open' },
  { id: '5', type: 'PRICE_HIKE', severity: 'HIGH', message: 'San Marzano tomatoes +8% from IL BOCCONCINO DIST.', time: '22 Jun, 10:01', status: 'resolved' }
];

export const initialInvoiceLines: InvoiceLine[] = [
  { id: 1, rawText: 'GIN XORIGUER 0.70', qty: '2', unitPrice: '€12.50', total: '€25.00', matchedProduct: 'GIN XORIGUER 70cl', confidence: 92, status: 'auto-matched' },
  { id: 2, rawText: 'LIMON 1KG', qty: '3', unitPrice: '€1.99', total: '€5.97', matchedProduct: 'Limon (Lemon) 1kg', confidence: 88, status: 'auto-matched' },
  { id: 3, rawText: 'LIMONCELLO ROSSI D ASIAGO 0.70', qty: '4', unitPrice: '€14.80', total: '€59.20', matchedProduct: 'Limoncello Rossi', confidence: 64, status: 'review' },
  { id: 4, rawText: 'ACEITE OLIVA ARBEQUINA 5L', qty: '1', unitPrice: '€32.90', total: '€32.90', matchedProduct: 'Olive Oil Arbequina 5L', confidence: 95, status: 'auto-matched' },
  { id: 5, rawText: 'RUCULA BABY 100G', qty: '2', unitPrice: '€1.69', total: '€3.38', matchedProduct: null, confidence: 42, status: 'review' },
];
