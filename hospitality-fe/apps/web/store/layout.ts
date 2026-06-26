import { create } from 'zustand';

interface LayoutState {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  fabOpen: boolean;
  setFabOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  fabOpen: false,
  setFabOpen: (fabOpen) => set({ fabOpen }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  dark: false,
  setDark: (dark) => set({ dark }),
}));
