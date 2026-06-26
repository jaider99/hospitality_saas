'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, DollarSign, TrendingDown, Users, AlertTriangle, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useLayoutStore } from '../../store/layout';
import { spendData, marginData, incidentsBaseData } from './mockData';
import { Btn } from './_components/ui';

export default function DashboardPage() {
  const router = useRouter();
  const { setChatOpen } = useLayoutStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const kpis = [
    { label: 'Total Spend', value: '€14,823', sub: 'June 2026', trend: '+€2,723 vs May', up: true, isGood: false, icon: DollarSign },
    { label: 'Gross Margin', value: '68.2%', sub: 'vs target 72%', trend: '−3.8% below target', up: false, isGood: false, icon: TrendingDown },
    { label: 'Labor Ratio', value: '31.4%', sub: 'Threshold: 30%', trend: '+1.4% over limit', up: true, isGood: false, icon: Users },
    { label: 'Open Incidents', value: '28', sub: '4 unresolved today', trend: '1 critical active', up: false, isGood: false, icon: AlertTriangle },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-screen-xl font-sans">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground leading-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Tuesday, 24 June 2026</p>
        </div>
        <button onClick={() => setChatOpen(true)} className="flex items-center gap-2 bg-[#151515] text-white dark:bg-[#efede7] dark:text-[#14130f] px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0">
          <MessageSquare size={15} /><span className="hidden sm:inline">Ask AI</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{k.label}</span>
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center"><k.icon size={15} className="text-muted-foreground" /></div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground leading-none font-mono">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${k.isGood ? 'text-[#1f8f5c]' : 'text-[#b23a3a]'}`}>
              {k.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              <span>{k.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Monthly Supplier Spend</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Jan – Jun 2026</span>
          </div>
          {mounted && (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={spendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1f8f5c" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#1f8f5c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`€${v.toLocaleString()}`, 'Spend']} />
                <Area type="monotone" dataKey="spend" stroke="#1f8f5c" strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 4, fill: '#1f8f5c' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4">Recipe Cost vs Target</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={marginData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 45]} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="actual" fill="#151515" radius={[3, 3, 0, 0]} name="Actual %" />
                <Bar dataKey="target" fill="#a8a8a4" radius={[3, 3, 0, 0]} name="Target %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent incidents */}
      <div className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Recent Incidents</h2>
          <button onClick={() => router.push('/dashboard/incidents')} className="text-xs text-[#1f8f5c] font-medium hover:underline">View all →</button>
        </div>
        <div className="space-y-2.5">
          {incidentsBaseData.filter((i) => i.status === 'OPEN').slice(0, 3).map((incident) => (
            <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                incident.severity === 'CRITICAL' ? 'bg-[#fceaea]' : incident.severity === 'HIGH' ? 'bg-[#fbf1dd]' : 'bg-muted'
              }`}>
                <AlertTriangle size={14} className={incident.severity === 'CRITICAL' ? 'text-[#b23a3a]' : incident.severity === 'HIGH' ? 'text-[#b07a1a]' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    incident.severity === 'CRITICAL' ? 'text-[#b23a3a]' : 'text-[#b07a1a]'
                  }`}>{incident.severity}</span>
                  <span className="text-xs text-muted-foreground capitalize">{incident.type.toLowerCase().replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm text-foreground mt-0.5 truncate">{incident.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 font-mono"><Clock size={10} />{incident.createdAt}</p>
              </div>
              <Btn size="sm" onClick={() => router.push('/dashboard/incidents')} className="flex-shrink-0">Resolve</Btn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
