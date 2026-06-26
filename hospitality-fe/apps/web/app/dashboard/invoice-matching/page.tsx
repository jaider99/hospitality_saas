'use client';

import React, { useState } from 'react';
import { AlertTriangle, TrendingDown, Check, X } from 'lucide-react';
import { invoiceLinesInit, catalogProducts } from '../mockData';
import { InvoiceLine } from '../types';
import { Badge } from '../_components/ui';

export default function InvoiceMatchingPage() {
  const [lines, setLines] = useState<InvoiceLine[]>(invoiceLinesInit);
  const [dropdownId, setDropdownId] = useState<number | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  const confirm = (id: number) => setLines((p) => p.map((l) => l.id === id ? { ...l, status: 'confirmed' } : l));
  const flagLine = (id: number) => setLines((p) => p.map((l) => l.id === id ? { ...l, status: 'flagged' } : l));
  const assign = (id: number, product: string) => {
    setLines((p) => p.map((l) => l.id === id ? { ...l, matchedProduct: product, status: 'review' } : l));
    setDropdownId(null); setCatalogSearch('');
  };

  const confStyle = (c: number) => {
    if (c >= 85) return { bg: 'bg-[#e6f4ec]', text: 'text-[#1f8f5c]', label: `${c}% Auto-Matched` };
    if (c >= 65) return { bg: 'bg-[#fbf1dd]', text: 'text-[#b07a1a]', label: `${c}% Review Required` };
    return { bg: 'bg-[#fceaea]', text: 'text-[#b23a3a]', label: `${c}% Low Confidence` };
  };

  const filteredCatalog = catalogProducts.filter((p) => p.toLowerCase().includes(catalogSearch.toLowerCase()));
  const confirmedCount = lines.filter((l) => l.status === 'confirmed').length;
  const needsReview = lines.filter((l) => l.status === 'review').length;

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      {dropdownId !== null && <div className="fixed inset-0 z-10" onClick={() => { setDropdownId(null); setCatalogSearch(''); }} />}

      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0 space-y-3 bg-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">Invoice Catalog Matching</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Vendo lo que tengo S.L. · Invoice #5865 · 14 Apr 2026</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="success">{confirmedCount} Confirmed</Badge>
            <Badge variant="warning">{needsReview} Pending Review</Badge>
            <Badge variant="error">{lines.filter((l) => l.status === 'flagged').length} Flagged</Badge>
          </div>
        </div>
        {/* Duplicate warning */}
        <div className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-3.5 flex items-start gap-3">
          <AlertTriangle size={15} className="text-[#b23a3a] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-[#7a2828]">Duplicate detected</span>
            <p className="text-sm text-[#7a2828] mt-0.5">This document matches: <strong>Invoice #5865 from Vendo lo que tengo S.L.</strong></p>
          </div>
          <button className="text-xs text-[#7a2828] font-semibold underline whitespace-nowrap hover:no-underline flex-shrink-0">View original →</button>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex-1 overflow-auto">
        <div className="hidden md:grid md:grid-cols-2 divide-x divide-border min-h-full">
          {/* Left — Raw OCR */}
          <div className="overflow-y-auto">
            <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-4 py-2.5 z-10">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Raw OCR Line Items</p>
            </div>
            <div className="divide-y divide-border">
              {lines.map((line) => {
                const cs = confStyle(line.confidence);
                return (
                  <div key={line.id} className={`px-4 py-4 ${
                    line.status === 'confirmed' ? 'bg-[#e6f4ec]/20' :
                    line.status === 'flagged' ? 'bg-[#fceaea]/15 opacity-55' : ''
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-foreground leading-tight font-mono">{line.rawText}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${cs.bg} ${cs.text}`}>{cs.label}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                      <span>Qty: <strong className="text-foreground">{line.qty}</strong></span>
                      <span>Unit: <strong className="text-foreground">{line.unitPrice}</strong></span>
                      <span>Total: <strong className="text-foreground">{line.total}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — Catalog match */}
          <div className="overflow-y-auto">
            <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-4 py-2.5 z-10">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Catalog Match & Actions</p>
            </div>
            <div className="divide-y divide-border">
              {lines.map((line) => (
                <div key={line.id} className={`px-4 py-4 space-y-2.5 ${
                  line.status === 'confirmed' ? 'bg-[#e6f4ec]/20' :
                  line.status === 'flagged' ? 'bg-[#fceaea]/15 opacity-55' : ''
                }`}>
                  <div className="relative z-20">
                    <button onClick={() => { setDropdownId(dropdownId === line.id ? null : line.id); setCatalogSearch(''); }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors text-left ${
                        !line.matchedProduct ? 'bg-[#fceaea]/40 border-[#ffb4ab] text-[#7a2828]' : 'bg-muted border-border text-foreground hover:border-[#151515]/30'
                      }`}>
                      <span className="truncate">{line.matchedProduct || 'No match — assign manually'}</span>
                      <TrendingDown size={14} className="text-muted-foreground flex-shrink-0" />
                    </button>
                    {dropdownId === line.id && (
                      <div className="absolute top-full left-0 right-0 z-30 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
                        <div className="p-2 border-b border-border">
                          <input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} autoFocus
                            placeholder="Search catalog products…"
                            className="w-full bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {filteredCatalog.map((p) => (
                            <button key={p} onClick={() => assign(line.id, p)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors">{p}</button>
                          ))}
                          {!filteredCatalog.length && <p className="px-3 py-3 text-xs text-muted-foreground">No matches found</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => confirm(line.id)} disabled={line.status === 'confirmed' || line.status === 'flagged'}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        line.status === 'confirmed'
                          ? 'bg-[#e6f4ec] border-[#9feacf] text-[#1f8f5c] cursor-default'
                          : 'bg-card border-border text-foreground hover:bg-[#e6f4ec] hover:border-[#9feacf] hover:text-[#1f8f5c]'
                      }`}>
                      <Check size={13} />{line.status === 'confirmed' ? 'Confirmed' : 'Confirm Match'}
                    </button>
                    <button onClick={() => flagLine(line.id)} disabled={line.status === 'flagged' || line.status === 'confirmed'}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        line.status === 'flagged'
                          ? 'bg-[#fceaea] border-[#ffb4ab] text-[#b23a3a] cursor-default'
                          : 'bg-card border-border text-foreground hover:bg-[#fceaea] hover:border-[#ffb4ab] hover:text-[#b23a3a]'
                      }`}>
                      <X size={13} />Flag
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile vertical flow */}
        <div className="md:hidden divide-y divide-border">
          {lines.map((line) => {
            const cs = confStyle(line.confidence);
            return (
              <div key={line.id} className={`p-4 space-y-3 ${
                line.status === 'confirmed' ? 'bg-[#e6f4ec]/10' :
                line.status === 'flagged' ? 'bg-[#fceaea]/10 opacity-70' : ''
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cs.bg} ${cs.text}`}>{cs.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">Total: {line.total}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground font-mono">{line.rawText}</p>
                </div>
                <div className="relative">
                  <button onClick={() => { setDropdownId(dropdownId === line.id ? null : line.id); setCatalogSearch(''); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs text-left ${
                      !line.matchedProduct ? 'bg-[#fceaea]/40 border-[#ffb4ab] text-[#7a2828]' : 'bg-muted border-border text-foreground'
                    }`}>
                    <span className="truncate">{line.matchedProduct || 'Unassigned — Tap to select'}</span>
                    <TrendingDown size={13} className="text-muted-foreground" />
                  </button>
                  {dropdownId === line.id && (
                    <div className="absolute bottom-full left-0 right-0 z-30 bg-card border border-border rounded-lg shadow-xl mb-1 overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} autoFocus
                          placeholder="Search product..." className="w-full bg-muted rounded-md px-2.5 py-1.5 text-xs focus:outline-none" />
                      </div>
                      <div className="max-h-36 overflow-y-auto">
                        {filteredCatalog.map((p) => (
                          <button key={p} onClick={() => assign(line.id, p)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted">{p}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => confirm(line.id)} disabled={line.status === 'confirmed' || line.status === 'flagged'}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                      line.status === 'confirmed' ? 'bg-[#e6f4ec] text-[#1f8f5c]' : 'bg-card border-border text-foreground'
                    }`}>
                    <Check size={12} />Confirm
                  </button>
                  <button onClick={() => flagLine(line.id)} disabled={line.status === 'flagged' || line.status === 'confirmed'}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                      line.status === 'flagged' ? 'bg-[#fceaea] text-[#b23a3a]' : 'bg-card border-border text-foreground'
                    }`}>
                    <X size={12} />Flag
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
