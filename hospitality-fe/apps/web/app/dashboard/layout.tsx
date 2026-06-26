'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { useLayoutStore } from '../../store/layout';
import { RefreshCw, TrendingDown, MessageSquare } from 'lucide-react';
import { navItems } from './mockData';
import {
  Sidebar,
  TopBar,
  MobileNav,
  UploadSheet,
  ChatPanel
} from './_components/layout-components';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, logout, user } = useAuthStore();

  const {
    chatOpen,
    setChatOpen,
    fabOpen,
    setFabOpen,
    dark
  } = useLayoutStore();

  const [mounted, setMounted] = useState(false);

  // 1. Force Redirect if unauthorized
  useEffect(() => {
    if (!accessToken) {
      router.push('/');
    } else {
      setMounted(true);
    }
  }, [accessToken, router]);

  // Sync Tailwind .dark class with React state
  useEffect(() => {
    const root = window.document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [dark]);

  if (!accessToken || !mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fafaf8]">
        <RefreshCw className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  const activeScreen = pathname === '/dashboard' ? 'dashboard' : pathname.replace('/dashboard/', '');
  const isFullHeightScreen = activeScreen === 'incidents' || activeScreen === 'invoice-matching';
  const userName = user?.name || 'General Manager';
  const activeLabel = navItems.find((n) => n.id === activeScreen)?.label ?? activeScreen;

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden flex flex-col font-sans">
      <div className="flex flex-1 min-h-0">
        <Sidebar logoutAction={logout} userName={userName} />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TopBar />

          {/* Desktop breadcrumb navigation */}
          <div className="hidden md:flex items-center justify-between px-6 py-2.5 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hospitality Elite</span>
              <TrendingDown size={13} className="text-muted-foreground rotate-90" />
              <span className="text-sm font-medium text-foreground">{activeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setChatOpen(!chatOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  chatOpen ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card text-foreground border-border hover:bg-muted'
                }`}>
                <MessageSquare size={14} />AI Assistant
              </button>
            </div>
          </div>

          {/* Page contents renderer */}
          <main className={`flex-1 min-h-0 ${isFullHeightScreen ? 'overflow-hidden' : 'overflow-y-auto pb-28 md:pb-0'}`}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Shell Addons */}
      <MobileNav />
      <UploadSheet open={fabOpen} onClose={() => setFabOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
