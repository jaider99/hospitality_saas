'use client';

import React from 'react';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { extractedProducts } from '../mockData';
import { Badge, Btn } from '../_components/ui';

export default function ExtractedProductsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl pb-32 md:pb-8 font-sans">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Extracted Products</h1>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-sm text-muted-foreground">Vendo lo que tengo S.L. · Doc #5865</span>
          <Badge variant="success">Completed</Badge>
        </div>
      </div>

      <div className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-4 mb-5 space-y-1">
        <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-[#b23a3a]" /><span className="text-sm font-bold text-[#b23a3a]">Duplicate detected</span></div>
        <p className="text-sm font-medium text-[#151515]">Invoice #5865 from Vendo lo que tengo S.L. matches an existing entry.</p>
        <button className="text-xs text-[#b23a3a] font-medium hover:underline mt-0.5">↗ View original</button>
      </div>

      <div className="grid grid-cols-4 px-4 mb-2">
        {['Item', 'Qty', 'Price', 'Total'].map((h) => <span key={h} className="text-xs text-muted-foreground font-medium">{h}</span>)}
      </div>
      <div className="space-y-2 mb-6">
        {extractedProducts.map((row, i) => (
          <div key={i} className="bg-card rounded-xl border border-border grid grid-cols-4 px-4 py-3.5 items-center shadow-sm">
            <span className="text-sm font-medium text-foreground">{row.item}</span>
            <span className="text-sm text-muted-foreground font-mono">{row.qty}</span>
            <span className="text-sm text-muted-foreground font-mono">{row.price}</span>
            <span className="text-sm font-semibold text-foreground font-mono">{row.total}</span>
          </div>
        ))}
      </div>

      <div className="bg-primary rounded-xl px-4 py-3.5 flex items-center justify-between mb-4">
        <span className="text-primary-foreground/60 text-sm">Total</span>
        <span className="text-primary-foreground font-semibold font-mono">€40.77</span>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-primary flex z-20">
        <button className="flex-1 py-4 flex items-center justify-center gap-2 text-white font-medium text-sm hover:bg-white/5 transition-colors"><Pencil size={16} />Edit</button>
        <div className="w-px bg-white/15" />
        <button className="flex-1 py-4 flex items-center justify-center gap-2 text-[#ff6b6b] font-medium text-sm hover:bg-white/5 transition-colors"><Trash2 size={16} />Delete</button>
      </div>
      <div className="hidden md:flex gap-3">
        <Btn className="gap-2"><Pencil size={15} />Edit Items</Btn>
        <Btn variant="danger" className="gap-2"><Trash2 size={15} />Delete Document</Btn>
      </div>
    </div>
  );
}
