'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import {
  Zap, TrendingDown, LogOut, Menu, MessageSquare, Plus, Home,
  BarChart2, Upload, AlertCircle, Camera, Pencil, ArrowUpRight, X,
  Bot, Mic, Send, Volume2, Pause, ChevronDown, Building2, Check,
  Utensils,
} from 'lucide-react';
import { useLayoutStore } from '../../../store/layout';
import { useAuthStore } from '../../../store/auth';
import { navItems, chatInit } from '../mockData';
import { ChatMsg, VoiceState } from '../types';
import {
  getAllRestaurantsAction,
  createRestaurantAction,
  switchRestaurantAction,
  getRestaurantAction,
} from '../settings/actions';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Restaurant {
  id: number;
  name: string;
  address?: string;
  currency?: string;
  operational_status?: string;
}

// ─── Add Restaurant Modal (portal — renders outside sidebar) ─────────────────

function AddRestaurantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: Restaurant) => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Reset form on open
  useEffect(() => {
    if (open) { setName(''); setAddress(''); setPhone(''); setCurrency('EUR'); setError(null); }
  }, [open]);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Restaurant name is required.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const created = await createRestaurantAction({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        currency,
      });
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create restaurant.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Restaurant"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden z-10 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <Building2 size={18} className="text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">New Restaurant</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add a new venue to your platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
              Restaurant Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bistro Élite Barcelona"
              required
              autoFocus
              className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, Country"
              className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Phone + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 890"
                className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
                <option value="GBP">GBP £</option>
                <option value="INR">INR ₹</option>
                <option value="AED">AED د.إ</option>
                <option value="CAD">CAD $</option>
                <option value="AUD">AUD $</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold border border-border rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Create Restaurant
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

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

// ─── AI Chat Panel ───────────────────────────────────────────────────────────

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

        {/* Listening waveform */}
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

        {/* Suggestions + input */}
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

// ─── Restaurant Switcher (sidebar widget) ────────────────────────────────────

function RestaurantSwitcher({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const { user, login, accessToken, apiClient } = useAuthStore();
  // Only SUPER_ADMIN can switch restaurants
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [open, setOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const [activeRestaurantName, setActiveRestaurantName] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load the current restaurant name once on mount, and also prefetch the restaurants list if SUPER_ADMIN
  useEffect(() => {
    if (!user?.restaurant_id) return;
    getRestaurantAction()
      .then((r) => setActiveRestaurantName(r.name))
      .catch(() => setActiveRestaurantName('My Restaurant'));

    if (isSuperAdmin) {
      setLoadingList(true);
      getAllRestaurantsAction()
        .then((data) => setRestaurants(data))
        .catch(() => setRestaurants([]))
        .finally(() => setLoadingList(false));
    }
  }, [user?.restaurant_id, isSuperAdmin]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Only allow opening if the user is SUPER_ADMIN and owns multiple restaurants
  const canSwitch = isSuperAdmin && restaurants.length > 1;

  const handleOpen = () => {
    if (!canSwitch) return;
    setOpen(!open);
  };

  const handleSwitch = async (r: Restaurant) => {
    if (r.id === user?.restaurant_id) { setOpen(false); return; }
    setSwitching(r.id);
    try {
      await switchRestaurantAction(r.id);
      const profile = await apiClient.getMe();
      login({ accessToken: accessToken || 'supertokens-active', refreshToken: 'supertokens-active', user: profile });
      setActiveRestaurantName(r.name);
      setOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to switch restaurant', err);
    } finally {
      setSwitching(null);
    }
  };

  const displayName = activeRestaurantName || 'Loading…';

  // ── Collapsed: icon only ──────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="px-2 py-2.5 flex justify-center">
        <div
          title={displayName}
          onClick={canSwitch ? handleOpen : undefined}
          className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center transition-colors ${
            canSwitch ? 'cursor-pointer hover:bg-white/20' : 'cursor-default'
          }`}
        >
          <Utensils size={16} className="text-white/80" />
        </div>
      </div>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────
  return (
    <div className="relative px-3 py-2.5" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={canSwitch ? handleOpen : undefined}
        disabled={!canSwitch}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 bg-white/8 border border-white/10 ${
          canSwitch
            ? 'cursor-pointer hover:bg-white/12 hover:border-white/20 active:scale-[0.98]'
            : 'cursor-default'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <Utensils size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/40 font-semibold leading-none mb-0.5 uppercase tracking-widest">Active Restaurant</p>
          <p className="text-sm font-semibold text-white truncate leading-tight">{displayName}</p>
        </div>
        {canSwitch && (
          <ChevronDown
            size={14}
            className={`text-white/40 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-white/70' : ''}`}
          />
        )}
      </button>

      {/* Dropdown */}
      {canSwitch && open && (
        <div className="absolute left-3 right-3 top-full mt-1.5 z-[100] bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-white/8">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Your Restaurants</p>
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {restaurants.map((r) => {
              const isActive = r.id === user?.restaurant_id;
              const isSwitching = switching === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSwitch(r)}
                  disabled={isSwitching}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-white/8'}`}>
                    <Building2 size={12} className={isActive ? 'text-white' : 'text-white/40'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.address && <p className="text-[10px] text-white/30 truncate mt-0.5">{r.address}</p>}
                  </div>
                  {isSwitching ? (
                    <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                  ) : isActive ? (
                    <Check size={13} className="text-white/60 flex-shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({ logoutAction, userName }: { logoutAction: () => void; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen } = useLayoutStore();

  const activeScreen = pathname === '/dashboard' ? 'dashboard' : pathname.replace('/dashboard/', '');

  const itemModuleMap: Record<string, string> = {
    dashboard: 'dashboard',
    documents: 'documents',
    'invoice-matching': 'reconciliation',
    review: 'incidents',
    products: 'products',
    recipes: 'recipes',
    labor: 'staff_costs',
    settings: 'restaurant_settings',
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!user) return false;
    if (user.role?.toUpperCase() === 'SUPER_ADMIN') return true;
    const moduleName = itemModuleMap[item.id];
    if (!moduleName) return true;
    const modPerm = (user.permissions?.[moduleName] || {}) as any;
    return modPerm.view && modPerm.view !== 'None';
  });

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed md:relative top-0 left-0 h-full z-50 flex flex-col bg-primary text-primary-foreground transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${sidebarCollapsed ? 'md:w-[72px]' : 'w-[240px]'}`}
      >
        {/* ── Brand ── */}
        <div className={`flex items-center gap-3 border-b border-white/10 flex-shrink-0 ${sidebarCollapsed ? 'px-4 py-4 justify-center' : 'px-5 py-4'}`}>
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={15} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-white font-semibold text-base leading-none">Hospitality Elite</span>
          )}
        </div>

        {/* ── Collapse toggle ── */}
        <button
          className="hidden md:flex absolute -right-3 top-[60px] w-6 h-6 bg-primary border border-white/20 rounded-full items-center justify-center hover:opacity-95 transition-all"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <TrendingDown size={11} className={`text-white/65 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        {/* ── Restaurant Switcher ── */}
        <div className="border-b border-white/10 flex-shrink-0">
          <RestaurantSwitcher
            collapsed={sidebarCollapsed}
          />
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto scrollbar-thin">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                router.push(item.id === 'dashboard' ? '/dashboard' : `/dashboard/${item.id}`);
                setSidebarOpen(false);
              }}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                activeScreen === item.id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white hover:bg-white/8'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <item.icon size={17} className="flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {item.badge != null && (
                    <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full font-bold">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* ── User footer ── */}
        <div className="border-t border-white/10 px-3 py-3 flex-shrink-0">
          {sidebarCollapsed ? (
            <button
              title="Logout"
              onClick={logoutAction}
              className="w-full flex items-center justify-center p-2.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <LogOut size={16} className="text-white/50" />
            </button>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/8 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-semibold truncate leading-tight">{userName}</div>
                <div className="text-white/35 text-[10px] truncate mt-0.5 capitalize">
                  {user?.role?.replace(/_/g, ' ').toLowerCase() || 'Staff'}
                </div>
              </div>
              <button
                onClick={logoutAction}
                title="Logout"
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors opacity-0 group-hover:opacity-100"
              >
                <LogOut size={14} className="text-white/50" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

export function TopBar() {
  const { setSidebarOpen, chatOpen, setChatOpen } = useLayoutStore();
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0 font-sans">
      <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
        <Menu size={20} className="text-foreground" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-accent rounded-md flex items-center justify-center"><Zap size={11} className="text-white" /></div>
        <span className="text-sm font-semibold text-foreground">Hospitality Elite</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setChatOpen(!chatOpen)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <MessageSquare size={19} className="text-foreground" />
        </button>
      </div>
    </div>
  );
}

// ─── MobileNav ───────────────────────────────────────────────────────────────

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { fabOpen, setFabOpen } = useLayoutStore();

  const activeScreen = pathname === '/dashboard' ? 'dashboard' : pathname.replace('/dashboard/', '');

  const items = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'recipes', label: 'Metrics', icon: BarChart2 },
    { id: 'documents', label: 'Uploads', icon: Upload },
    { id: 'review', label: 'Alert', icon: AlertCircle },
  ];

  const itemModuleMap: Record<string, string> = {
    dashboard: 'dashboard',
    recipes: 'recipes',
    documents: 'documents',
    review: 'incidents',
  };

  const filteredItems = items.filter((item) => {
    if (!user) return false;
    if (user.role?.toUpperCase() === 'SUPER_ADMIN') return true;
    const moduleName = itemModuleMap[item.id];
    if (!moduleName) return true;
    const modPerm = (user.permissions?.[moduleName] || {}) as any;
    return modPerm.view && modPerm.view !== 'None';
  });

  const half = Math.ceil(filteredItems.length / 2);
  const leftItems = filteredItems.slice(0, half);
  const rightItems = filteredItems.slice(half);

  const canUpload = user?.role?.toUpperCase() === 'SUPER_ADMIN' || user?.permissions?.documents?.create === true;

  return (
    <div className="fixed bottom-5 left-4 right-4 md:hidden z-30 font-sans">
      <div className="bg-card rounded-full shadow-xl border border-border flex items-center justify-between px-4 py-2 relative">
        {leftItems.map((item) => (
          <button key={item.id} onClick={() => router.push(item.id === 'dashboard' ? '/dashboard' : `/dashboard/${item.id}`)}
            className={`flex flex-col items-center gap-0.5 p-1.5 transition-colors ${activeScreen === item.id ? 'text-[#151515] dark:text-[#efede7]' : 'text-muted-foreground'}`}>
            <item.icon size={20} />
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        ))}

        {canUpload ? (
          <div className="relative -mt-8">
            <button onClick={() => setFabOpen(!fabOpen)}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ring-4 ring-[#fafaf8] dark:ring-[#14130f] transition-all duration-200 ${
                fabOpen ? 'bg-[#b23a3a] rotate-45' : 'bg-primary hover:opacity-90'
              }`}>
              <Plus size={24} className="text-primary-foreground transition-transform duration-200" />
            </button>
          </div>
        ) : (
          <div className="w-1" />
        )}

        {rightItems.map((item) => (
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
