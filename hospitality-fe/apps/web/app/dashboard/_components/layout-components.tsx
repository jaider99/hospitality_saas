'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Zap, TrendingDown, LogOut, Menu, MessageSquare, Plus, Home,
  BarChart2, Upload, AlertCircle, Camera, Pencil, ArrowUpRight, X,
  Bot, Mic, Send, Volume2, Pause
} from 'lucide-react';
import { useLayoutStore } from '../../../store/layout';
import { navItems, chatInit } from '../mockData';
import { ChatMsg, VoiceState } from '../types';

// ─── Upload FAB Sheet ────────────────────────────────────────────────────────

export function UploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const opts = [
    { icon: Camera, label: 'Scan Invoice with Camera', sub: 'Capture a receipt or delivery note' },
    { icon: Upload, label: 'Choose PDF / Photo from Files', sub: 'Select an existing file from your device' },
    { icon: Pencil, label: 'Log Manual Expense', sub: 'Enter an expense or delivery note manually' },
  ];
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl p-5 pb-10 md:hidden font-sans">
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-5" />
        <h2 className="text-base font-semibold text-foreground mb-4">Add Document</h2>
        <div className="space-y-2.5 mb-4">
          {opts.map((o) => (
            <button key={o.label} onClick={onClose}
              className="w-full flex items-center gap-4 p-4 bg-muted/40 hover:bg-muted border border-border rounded-xl transition-colors text-left">
              <div className="w-10 h-10 bg-[#151515] rounded-xl flex items-center justify-center flex-shrink-0">
                <o.icon size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{o.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{o.sub}</p>
              </div>
              <ArrowUpRight size={15} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-3 text-sm font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors border border-border">Cancel</button>
      </div>
    </>
  );
}

// ─── Siri Voice Chat Panel ───────────────────────────────────────────────────

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<ChatMsg[]>(chatInit);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<VoiceState>('idle');
  const [streamText, setStreamText] = useState('');
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setMsgs((p) => [...p, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      setMsgs((p) => [...p, {
        role: 'ai',
        text: 'Based on your recent invoices, total beverage spend was €1,247.80 last week. The Limoncello price spike (+18%) is your primary cost pressure. Recommend reviewing the recipe margin for Limoncello Risotto — currently 38.5%, well above the 33% target.',
        hasPlayback: true,
      }]);
      setLoading(false);
    }, 1200);
  };

  const startListening = () => {
    setVoice('listening');
    setTimeout(() => {
      setVoice('streaming');
      const phrase = 'What did I spend on beverage suppliers';
      let i = 0;
      const tick = () => {
        i++;
        setStreamText(phrase.slice(0, i * 4));
        if (i * 4 < phrase.length) setTimeout(tick, 80);
        else setTimeout(() => {
          setStreamText(phrase + ' last week?');
          setTimeout(() => { setVoice('idle'); send(phrase + ' last week?'); setStreamText(''); }, 700);
        }, 400);
      };
      tick();
    }, 2200);
  };

  const stopListening = () => { setVoice('idle'); setStreamText(''); };

  const waveColors = ['#4edea3', '#1f8f5c', '#00a36b', '#4edea3', '#1f8f5c', '#4edea3', '#00a36b', '#1f8f5c'];
  const waveDelays = [0, 0.12, 0.24, 0.08, 0.32, 0.16, 0.28, 0.04];

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[390px] bg-card border-l border-border flex flex-col z-50 shadow-2xl font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${voice === 'listening' ? 'bg-[#b23a3a]' : 'bg-[#1f8f5c]'}`}>
              <Bot size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">AI Assistant</p>
              <p className={`text-xs mt-0.5 transition-colors ${
                voice === 'listening' ? 'text-[#b23a3a]' :
                voice === 'streaming' ? 'text-[#b07a1a]' :
                'text-[#1f8f5c]'
              }`}>
                {voice === 'listening' ? '● Listening…' : voice === 'streaming' ? '● Transcribing…' : voice === 'playback' ? '● Playing response' : 'Online · RAG-powered'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><X size={17} className="text-muted-foreground" /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-secondary text-foreground rounded-br-sm' : 'bg-[#151515] text-white rounded-bl-sm dark:bg-[#2e2c26]'
              }`}>
                {m.text}
              </div>
              {m.role === 'ai' && m.hasPlayback && (
                <div className="flex items-center gap-2 ml-1">
                  {playingIdx === i ? (
                    <>
                      <div className="flex items-end gap-0.5 h-4">
                        {[0, 1, 2, 3, 4].map((j) => (
                          <div key={j} className="w-1 bg-[#1f8f5c] rounded-full origin-bottom animate-wave-bar"
                            style={{ height: 14, animationDelay: `${j * 0.1}s` }} />
                        ))}
                      </div>
                      <span className="text-xs text-[#1f8f5c]">Playing</span>
                      <button onClick={() => setPlayingIdx(null)} className="w-5 h-5 bg-[#1f8f5c] rounded-full flex items-center justify-center">
                        <Pause size={9} className="text-white" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setPlayingIdx(i)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#1f8f5c] transition-colors">
                      <Volume2 size={13} /><span>Play response</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Streaming draft text */}
          {voice === 'streaming' && streamText && (
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-muted/70 border border-dashed border-border rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm text-foreground/50 leading-relaxed">
                {streamText}
                <span className="inline-block w-0.5 h-3.5 bg-foreground/40 ml-0.5 -mb-0.5 animate-blink" />
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#151515] text-white rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm dark:bg-[#2e2c26]">
                <span className="animate-pulse">···</span>
              </div>
            </div>
          )}
        </div>

        {/* Listening state — waveform */}
        {voice === 'listening' && (
          <div className="px-4 pt-4 pb-2 border-t border-border flex flex-col items-center gap-4 flex-shrink-0">
            <div className="flex items-center justify-center gap-1 h-10">
              {waveDelays.map((delay, i) => (
                <div key={i} className="w-1.5 rounded-full origin-bottom animate-wave-bar"
                  style={{ height: 32, backgroundColor: waveColors[i], animationDelay: `${delay}s` }} />
              ))}
            </div>
            <button onClick={stopListening}
              className="w-16 h-16 rounded-full bg-[#b23a3a] flex items-center justify-center shadow-xl animate-mic-glow">
              <X size={24} className="text-white" />
            </button>
            <p className="text-xs text-muted-foreground pb-2">Tap to stop recording</p>
          </div>
        )}

        {/* Quick suggestions + input */}
        {voice !== 'listening' && (
          <>
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {['Last week spend?', 'Labor ratio?', 'Critical incidents?', 'Recipe margins?'].map((q) => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-xs bg-muted border border-border text-foreground px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-[#151515] hover:text-white hover:border-transparent transition-colors dark:hover:bg-[#efede7] dark:hover:text-[#14130f]">
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-border flex-shrink-0">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                <button onClick={startListening}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    voice === 'streaming' ? 'bg-[#1f8f5c] text-white' : 'bg-background/80 text-muted-foreground hover:bg-[#1f8f5c] hover:text-white'
                  }`}>
                  <Mic size={15} />
                </button>
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Ask anything about your venue…"
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground" />
                <button onClick={() => send()} className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity">
                  <Send size={13} className="text-primary-foreground" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Sidebar component ───────────────────────────────────────────────────────

export function Sidebar({ logoutAction, userName }: { logoutAction: () => void; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarCollapsed, setSidebarCollapsed,
    sidebarOpen, setSidebarOpen
  } = useLayoutStore();

  const activeScreen = pathname === '/dashboard' ? 'dashboard' : pathname.replace('/dashboard/', '');

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed md:relative top-0 left-0 h-full z-50 flex flex-col bg-primary text-primary-foreground transition-all duration-300 flex-shrink-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${sidebarCollapsed ? 'md:w-[72px]' : 'w-[240px]'}`}>

        <div className={`flex items-center gap-3 border-b border-white/10 flex-shrink-0 ${sidebarCollapsed ? 'px-4 py-5 justify-center' : 'px-5 py-5'}`}>
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0"><Zap size={15} className="text-white" /></div>
          {!sidebarCollapsed && <span className="text-white font-semibold text-base leading-none">Hospitality Elite</span>}
        </div>

        <button className="hidden md:flex absolute -right-3 top-[72px] w-6 h-6 bg-primary border border-white/20 rounded-full items-center justify-center hover:opacity-95 transition-all"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <TrendingDown size={11} className={`text-white/65 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => {
              router.push(item.id === 'dashboard' ? '/dashboard' : `/dashboard/${item.id}`);
              setSidebarOpen(false);
            }} title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                activeScreen === item.id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white hover:bg-white/8'
              } ${sidebarCollapsed && 'justify-center'}`}>
              <item.icon size={17} className="flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {item.badge != null && <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full font-bold">{item.badge > 9 ? '9+' : item.badge}</span>}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4 space-y-1 flex-shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/8 transition-colors cursor-pointer" onClick={logoutAction}>
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate leading-tight">{userName}</div>
                <div className="text-white/40 text-xs truncate mt-0.5">Logout</div>
              </div>
              <LogOut size={15} className="text-white/30 flex-shrink-0" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── TopBar component ────────────────────────────────────────────────────────

export function TopBar() {
  const { setSidebarOpen, chatOpen, setChatOpen } = useLayoutStore();
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0 font-sans">
      <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><Menu size={20} className="text-foreground" /></button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-accent rounded-md flex items-center justify-center"><Zap size={11} className="text-white" /></div>
        <span className="text-sm font-semibold text-foreground">Hospitality Elite</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setChatOpen(!chatOpen)} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><MessageSquare size={19} className="text-foreground" /></button>
      </div>
    </div>
  );
}

// ─── MobileNav component ─────────────────────────────────────────────────────

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { fabOpen, setFabOpen } = useLayoutStore();

  const activeScreen = pathname === '/dashboard' ? 'dashboard' : pathname.replace('/dashboard/', '');

  const items = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'recipes', label: 'Metrics', icon: BarChart2 },
    { id: 'documents', label: 'Uploads', icon: Upload },
    { id: 'review', label: 'Alert', icon: AlertCircle },
  ];

  return (
    <div className="fixed bottom-5 left-4 right-4 md:hidden z-30 font-sans">
      <div className="bg-card rounded-full shadow-xl border border-border flex items-center justify-between px-4 py-2 relative">
        {items.slice(0, 2).map((item) => (
          <button key={item.id} onClick={() => router.push(item.id === 'dashboard' ? '/dashboard' : `/dashboard/${item.id}`)}
            className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors ${activeScreen === item.id ? 'text-[#151515] dark:text-[#efede7]' : 'text-muted-foreground'}`}>
            <item.icon size={20} />
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        ))}

        {/* Center FAB */}
        <div className="relative -mt-8">
          <button onClick={() => setFabOpen(!fabOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ring-4 ring-[#fafaf8] dark:ring-[#14130f] transition-all duration-200 ${
              fabOpen ? 'bg-[#b23a3a] rotate-45' : 'bg-primary hover:opacity-90'
            }`}>
            <Plus size={24} className="text-primary-foreground transition-transform duration-200" />
          </button>
        </div>

        {items.slice(2).map((item) => (
          <button key={item.id} onClick={() => router.push(`/dashboard/${item.id}`)}
            className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors relative ${activeScreen === item.id ? 'text-[#151515] dark:text-[#efede7]' : 'text-muted-foreground'}`}>
            <item.icon size={20} />
            <span className="text-[9px] font-semibold">{item.label}</span>
            {item.id === 'review' && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#b23a3a] rounded-full border border-card" />}
          </button>
        ))}
      </div>
    </div>
  );
}
