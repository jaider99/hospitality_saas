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
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  fabOpen: false,
  setFabOpen: (fabOpen) => set({ fabOpen }),
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),

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
