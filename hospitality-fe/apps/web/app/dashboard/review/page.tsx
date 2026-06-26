'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Package, Clock, Check, X } from 'lucide-react';
import { reviewItems } from '../mockData';

export default function ReviewCenterPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'documents' | 'products' | 'suppliers'>('all');
  const [dismissed, setDismissed] = useState<number[]>([]);

  const metrics = [{ label: 'Open', value: '28' }, { label: 'Critical', value: '1' }, { label: 'AI review', value: '23' }, { label: 'Prices', value: '2' }];
  const tabs: ('all' | 'documents' | 'products' | 'suppliers')[] = ['all', 'documents', 'products', 'suppliers'];

  const filtered = reviewItems.filter((r) => {
    if (dismissed.includes(r.id)) return false;
    if (tab === 'documents') return r.category === 'document items';
    if (tab === 'products') return r.type === 'product_match';
    return true;
  });

  const getSevStyle = (sev: string) => {
    if (sev === 'CRITICAL') return { iconBg: 'bg-[#fceaea]', iconTxt: 'text-[#b23a3a]', lbl: 'text-[#7a2828]' };
    if (sev === 'HIGH') return { iconBg: 'bg-[#fbf1dd]', iconTxt: 'text-[#b07a1a]', lbl: 'text-[#b07a1a]' };
    return { iconBg: 'bg-muted', iconTxt: 'text-muted-foreground', lbl: 'text-muted-foreground' };
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl font-sans">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Review Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Items that require manual verification.</p>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-card border border-border rounded-xl p-4 mb-5">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-2xl font-semibold text-foreground">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize whitespace-nowrap ${
              tab === t ? 'bg-[#151515] text-white' : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((item) => {
          const s = getSevStyle(item.severity);
          return (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                  {item.type === 'price_alert' ? <TrendingUp size={17} className={s.iconTxt} /> : <Package size={17} className={s.iconTxt} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${s.lbl}`}>{item.type === 'price_alert' ? 'Price alert' : 'Product match'}</span>
                    <span className={`text-xs font-bold uppercase tracking-wider ${s.lbl}`}>{item.severity}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} />{item.time}</span>
                    <span className="text-xs text-muted-foreground">{item.category}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push(item.type === 'price_alert' ? '/dashboard/recipes' : '/dashboard/invoice-matching')}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                  {item.type === 'price_alert' ? 'Open Details' : 'Match Product'}
                </button>
                <button className="w-11 h-11 border border-border rounded-xl flex items-center justify-center hover:bg-[#e6f4ec] transition-colors"><Check size={17} className="text-[#1f8f5c]" /></button>
                <button onClick={() => setDismissed((p) => [...p, item.id])} className="w-11 h-11 border border-border rounded-xl flex items-center justify-center hover:bg-[#fceaea] transition-colors"><X size={17} className="text-[#b23a3a]" /></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <div className="w-12 h-12 bg-[#e6f4ec] rounded-2xl flex items-center justify-center mx-auto mb-3"><Check size={22} className="text-[#1f8f5c]" /></div>
            <p className="font-semibold text-foreground">All clear</p>
            <p className="text-sm text-muted-foreground mt-1">No items need review in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
