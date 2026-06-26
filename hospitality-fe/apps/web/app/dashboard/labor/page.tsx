'use client';

import React, { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { staff } from '../mockData';
import { Btn } from '../_components/ui';

export default function LaborPage() {
  const [estimatedSales, setEstimatedSales] = useState('4500');
  const [auditRan, setAuditRan] = useState(false);
  const totalPayroll = staff.reduce((s, m) => s + m.pay, 0);
  const ratio = (totalPayroll / (parseFloat(estimatedSales) || 1)) * 100;
  const over = ratio > 30;
  const roleColors: Record<string, string> = {
    CHEF: 'bg-[#e6eef8] text-[#2f6bb0]',
    WAITER: 'bg-[#e6f4ec] text-[#1f8f5c]',
    MANAGER: 'bg-primary text-primary-foreground',
    HOST: 'bg-[#fbf1dd] text-[#b07a1a]'
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-screen-lg font-sans">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Staff & Labor</h1>
        <Btn><Plus size={15} /><span className="hidden sm:inline">Add Staff</span></Btn>
      </div>

      <div className={`rounded-xl border p-4 md:p-6 mb-6 ${over ? 'bg-[#fceaea] border-[#ffb4ab]' : 'bg-[#e6f4ec] border-[#9feacf]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={15} className={over ? 'text-[#b23a3a]' : 'text-[#1f8f5c]'} />
              <span className={`text-sm font-semibold ${over ? 'text-[#b23a3a]' : 'text-[#1f8f5c]'}`}>Daily Labor Audit</span>
            </div>
            <div className="text-3xl font-semibold text-foreground font-mono">{ratio.toFixed(1)}%</div>
            <p className={`text-sm mt-0.5 ${over ? 'text-[#b23a3a]' : 'text-[#1f8f5c]'}`}>{over ? '⚠ Exceeds 30% threshold' : '✓ Within threshold'}</p>
            {auditRan && over && <p className="text-xs text-[#b23a3a] mt-1.5 max-w-xs leading-relaxed">AI: Consider reducing floor staff by 1 on quiet Tuesday dinner shifts to bring ratio below 30%.</p>}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Est. Sales (€)</label>
              <input type="number" value={estimatedSales} onChange={(e) => { setEstimatedSales(e.target.value); setAuditRan(false); }}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm w-28 focus:outline-none" />
            </div>
            <button onClick={() => setAuditRan(true)} className="bg-[#151515] text-white dark:bg-[#efede7] dark:text-[#14130f] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Run Audit</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            ['Total Payroll', `€${totalPayroll.toFixed(2)}`],
            ['Active Staff', `${staff.filter((s) => s.status === 'clocked-in').length}`],
            ['Est. Sales', `€${parseFloat(estimatedSales || '0').toLocaleString()}`],
            ['Threshold', '30.0%']
          ].map(([l, v]) => (
            <div key={l} className="bg-white/60 dark:bg-card/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-0.5">{l}</div>
              <div className="text-base font-semibold text-foreground font-mono">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Name', 'Role', 'Rate /hr', 'Hours Today', 'Status', 'Total Pay'].map((h) => (
                <th key={h} className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#151515] dark:bg-[#edece8] rounded-full flex items-center justify-center text-white dark:text-[#151515] text-xs font-semibold">
                      {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[s.role] || 'bg-muted'}`}>{s.role}</span></td>
                <td className="px-4 py-3.5"><span className="text-sm text-foreground font-mono">€{s.rate.toFixed(2)}</span></td>
                <td className="px-4 py-3.5"><span className="text-sm text-foreground font-mono">{s.hours}h</span></td>
                <td className="px-4 py-3.5">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${s.status === 'clocked-in' ? 'text-[#1f8f5c]' : 'text-muted-foreground'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.status === 'clocked-in' ? 'bg-[#1f8f5c]' : 'bg-muted-foreground/40'}`} />
                    {s.status === 'clocked-in' ? 'Clocked in' : 'Clocked out'}
                  </span>
                </td>
                <td className="px-4 py-3.5"><span className="text-sm font-semibold text-foreground font-mono">€{s.pay.toFixed(2)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-2.5">
        {staff.map((s) => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 bg-[#151515] dark:bg-[#edece8] rounded-full flex items-center justify-center text-white dark:text-[#151515] text-sm font-semibold flex-shrink-0">
              {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{s.name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${roleColors[s.role] || 'bg-muted'}`}>{s.role}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className={s.status === 'clocked-in' ? 'text-[#1f8f5c]' : 'text-muted-foreground'}>
                  {s.status === 'clocked-in' ? '● Clocked in' : '○ Clocked out'} · {s.hours}h
                </span>
                <span className="text-sm font-semibold text-foreground font-mono">€{s.pay.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
