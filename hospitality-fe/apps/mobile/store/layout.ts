import { create } from 'zustand';
import { Alert } from 'react-native';
import { Incident, InvoiceLine, ChatMsg } from '../constants/types';
import { initialIncidents, initialInvoiceLines } from '../constants/mockData';

interface LayoutState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  fabOpen: boolean;
  setFabOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;

  // Shared Data States
  incidents: Incident[];
  setIncidents: (incidents: Incident[]) => void;
  handleResolveIncident: (id: string) => void;
  handleDisputeIncident: (id: string) => void;

  invoiceLines: InvoiceLine[];
  setInvoiceLines: (updater: InvoiceLine[] | ((prev: InvoiceLine[]) => InvoiceLine[])) => void;

  // Chatbot States
  chatInput: string;
  setChatInput: (input: string) => void;
  chatHistory: ChatMsg[];
  setChatHistory: (history: ChatMsg[]) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isPlayingIdx: number | null;
  setIsPlayingIdx: (idx: number | null) => void;
  handleChatSend: (text?: string) => void;
  handleMicPress: () => void;

  // Invoices & Upload States
  invoices: any[];
  loadingInvoices: boolean;
  refreshingInvoices: boolean;
  fetchInvoices: (showLoader?: boolean) => Promise<void>;
  uploadInvoiceFile: (uri: string, name: string, mimeType: string) => Promise<void>;
  deleteInvoice: (id: number) => Promise<void>;
}

import { useAuthStore } from './auth';
import { router } from 'expo-router';

const formatDateSafe = (
  dateStr: string | null | undefined,
  options?: { month?: '2-digit' | 'short'; day?: '2-digit' | 'numeric'; year?: 'numeric' }
): string => {
  if (!dateStr) return '—';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return '—';
  const [yearStr, monthStr, dayStr] = parts;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed month
  const day = parseInt(dayStr, 10);

  const date = new Date(Date.UTC(year, month, day));
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: options?.month || '2-digit',
    day: options?.day || '2-digit',
    year: options?.year || 'numeric'
  });
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  fabOpen: false,
  setFabOpen: (fabOpen) => set({ fabOpen }),
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),

  invoices: [],
  loadingInvoices: true,
  refreshingInvoices: false,

  fetchInvoices: async (showLoader = true) => {
    const { apiClient } = useAuthStore.getState();
    if (!apiClient) return;

    if (showLoader) set({ loadingInvoices: true });
    try {
      const data = await apiClient.getInvoices();
      if (Array.isArray(data)) {
        const mapped = data.map((inv: any) => ({
          id: inv.id,
          supplier: inv.supplier_display_name || inv.supplier?.name || 'Unknown Supplier',
          docNum: inv.document_number || inv.invoice_number || '—',
          date: inv.document_date
            ? formatDateSafe(inv.document_date)
            : inv.issue_date
              ? formatDateSafe(inv.issue_date)
              : '—',
          rawDate: inv.document_date || inv.issue_date || null,
          uploadDate: inv.created_at
            ? new Date(inv.created_at).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              })
            : new Date().toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              }),
          amount: inv.total_amount || inv.total_with_iva || 0.0,
          type: inv.document_type || 'Invoice',
          status: inv.needs_review
            ? 'flagged'
            : (inv.status === 'PROCESSED' || inv.status === 'completed')
              ? 'completed'
              : inv.status === 'FAILED'
                ? 'rejected'
                : 'processing',
          icon: 'invoice',
          paymentStatus: inv.payment_status || 'Pending',
          userInitials: (inv.uploaded_by || 'SYS').slice(0, 2).toUpperCase(),
          ocrConfidence: inv.ocr_confidence,
          currency: inv.currency || 'EUR',
          isDuplicate: inv.is_duplicate,
          reviewReasons: inv.review_reasons,
        }));
        set({ invoices: mapped });
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      set({ loadingInvoices: false, refreshingInvoices: false });
    }
  },

  uploadInvoiceFile: async (uri, name, mimeType) => {
    const { apiClient, user } = useAuthStore.getState();
    if (!apiClient) return;

    // Add temporary local placeholder
    const tempId = `temp-${Date.now()}`;
    const placeholder = {
      id: tempId,
      supplier: '—',
      docNum: name || 'document',
      date: '—',
      uploadDate: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      amount: 0.0,
      type: 'Invoice',
      status: 'processing',
      paymentStatus: 'Pending',
      userInitials: (user?.name || 'SYS').slice(0, 2).toUpperCase(),
    };

    set((state) => ({ invoices: [placeholder, ...state.invoices] }));

    // Automatically navigate to documents tab
    router.push('/(tabs)/documents');

    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: name || 'invoice.pdf',
        type: mimeType || 'application/pdf',
      } as any);

      const uploadRes = await apiClient.uploadInvoice(formData);

      set((state) => ({
        invoices: state.invoices.map((d) =>
          d.id === tempId
            ? {
                ...d,
                id: uploadRes.invoiceId,
                supplier: uploadRes.supplierName || 'Unknown Supplier',
                amount: uploadRes.totalAmount || 0,
                status: 'processing'
              }
            : d
        )
      }));

      await get().fetchInvoices(false);
    } catch (err) {
      console.error("Upload failed", err);
      set((state) => ({
        invoices: state.invoices.map((d) =>
          d.id === tempId ? { ...d, status: 'rejected' } : d
        )
      }));
      throw err;
    }
  },

  deleteInvoice: async (id) => {
    const { apiClient } = useAuthStore.getState();
    if (!apiClient) return;
    try {
      await apiClient.deleteInvoice(id);
      set((state) => ({
        invoices: state.invoices.filter((d) => d.id !== id)
      }));
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  incidents: initialIncidents,
  setIncidents: (incidents) => set({ incidents }),
  handleResolveIncident: (id) => {
    set((state) => ({
      incidents: state.incidents.map((inc) =>
        inc.id === id ? { ...inc, status: 'resolved' } : inc
      ),
    }));
    Alert.alert('Success', 'Incident marked as resolved.');
  },
  handleDisputeIncident: (id) => {
    set((state) => ({
      incidents: state.incidents.map((inc) =>
        inc.id === id ? { ...inc, status: 'disputed' } : inc
      ),
    }));
    Alert.alert('Disputed', 'Incident marked as disputed under supplier review.');
  },

  invoiceLines: initialInvoiceLines,
  setInvoiceLines: (updater) => {
    if (typeof updater === 'function') {
      set((state) => ({ invoiceLines: updater(state.invoiceLines) }));
    } else {
      set({ invoiceLines: updater });
    }
  },

  chatInput: '',
  setChatInput: (chatInput) => set({ chatInput }),
  chatHistory: [
    { role: 'ai', text: "Hello! I'm your AI assistant. I can help you analyze supplier costs, recipe margins, and operational insights. What would you like to know?" }
  ],
  setChatHistory: (chatHistory) => set({ chatHistory }),
  isListening: false,
  setIsListening: (isListening) => set({ isListening }),
  isPlayingIdx: null,
  setIsPlayingIdx: (isPlayingIdx) => set({ isPlayingIdx }),

  handleChatSend: (text) => {
    const query = (text || get().chatInput).trim();
    if (!query) return;

    const newMsgs: ChatMsg[] = [...get().chatHistory, { role: 'user' as const, text: query }];
    set({ chatHistory: newMsgs, chatInput: '' });

    setTimeout(() => {
      let answer = "I couldn't contact the RAG server. Hendrick's Gin price increased by 7.3% last week.";
      if (query.toLowerCase().includes('spend') || query.toLowerCase().includes('beverage')) {
        answer = "Last week spend was €1,247.80 on beverage suppliers. Vendo lo que tengo S.L. accounted for €136.29.";
      } else if (query.toLowerCase().includes('labor')) {
        answer = "Labor cost is running at 31.4%. Recommend reducing 1 waiter from Tuesday dinner shifts.";
      } else if (query.toLowerCase().includes('incident') || query.toLowerCase().includes('exception')) {
        answer = "You have 4 unresolved alerts. Limoncello Rossi price spike (+18%) is critical.";
      }
      set({ chatHistory: [...newMsgs, { role: 'ai' as const, text: answer, hasPlayback: true }] });
    }, 1000);
  },

  handleMicPress: () => {
    set({ isListening: true });
    setTimeout(() => {
      set({ isListening: false });
      get().handleChatSend('What did I spend on beverage suppliers last week?');
    }, 2000);
  },
}));
