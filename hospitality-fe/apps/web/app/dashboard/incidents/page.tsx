'use client';

import React, { useState } from 'react';
import { GripVertical, Clock, Flag, Check, AlertTriangle, TrendingUp, Users, Package, CheckCircle } from 'lucide-react';
import { kanbanInit } from '../mockData';
import { KanbanCard, KanbanCol } from '../types';
import { Badge } from '../_components/ui';

export default function IncidentsPage() {
  const [cards, setCards] = useState<KanbanCard[]>(kanbanInit);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<KanbanCol | null>(null);

  const moveCard = (id: number, col: KanbanCol) => setCards((p) => p.map((c) => c.id === id ? { ...c, col } : c));

  const sevStyle = {
    CRITICAL: { iconBg: 'bg-[#fceaea]', iconTxt: 'text-[#b23a3a]', badgeTxt: 'text-[#7a2828]' },
    HIGH: { iconBg: 'bg-[#fbf1dd]', iconTxt: 'text-[#b07a1a]', badgeTxt: 'text-[#b07a1a]' },
    MEDIUM: { iconBg: 'bg-[#e6eef8]', iconTxt: 'text-[#2f6bb0]', badgeTxt: 'text-[#2f6bb0]' },
    LOW: { iconBg: 'bg-muted', iconTxt: 'text-muted-foreground', badgeTxt: 'text-muted-foreground' },
  };

  const typeIcon: Record<string, React.ElementType> = { PRICE_HIKE: TrendingUp, LABOR_COST: Users, WASTE: Package };
  const typeLabel: Record<string, string> = { PRICE_HIKE: 'Price Hike', LABOR_COST: 'Labor Cost', WASTE: 'Waste' };

  const columns: { id: KanbanCol; label: string; dot: string }[] = [
    { id: 'open', label: 'Open', dot: 'bg-[#b23a3a]' },
    { id: 'disputed', label: 'Disputed', dot: 'bg-[#b07a1a]' },
    { id: 'resolved', label: 'Resolved', dot: 'bg-[#1f8f5c]' },
  ];

  return (
    <div className="flex flex-col h-full p-4 md:p-6 lg:p-8 font-sans overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Incidents Board</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Drag cards to update exception status.</p>
        </div>
        <Badge variant="error">{cards.filter((c) => c.col === 'open' && (c.severity === 'CRITICAL' || c.severity === 'HIGH')).length} High-priority</Badge>
      </div>

      <div className="flex gap-4 overflow-x-auto flex-1 pb-4 min-h-0 scrollbar-thin">
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.col === col.id);
          const isOver = dragOver === col.id;
          return (
            <div key={col.id}
              className={`flex-shrink-0 w-72 md:flex-1 flex flex-col rounded-xl border transition-all ${
                isOver ? 'border-[#1f8f5c] bg-[#e6f4ec]/20 shadow-inner' : 'border-border bg-muted/15'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); if (draggingId !== null) moveCard(draggingId, col.id); setDraggingId(null); setDragOver(null); }}>

              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-card flex-shrink-0 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  <span className="text-xs bg-muted text-muted-foreground font-bold px-1.5 py-0.5 rounded-full">{colCards.length}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {colCards.map((card) => {
                  const s = sevStyle[card.severity] ?? sevStyle.LOW;
                  const Icon = typeIcon[card.type] ?? AlertTriangle;
                  return (
                     <div key={card.id} draggable
                      onDragStart={() => setDraggingId(card.id)}
                      onDragEnd={() => { setDraggingId(null); setDragOver(null); }}
                      className={`bg-card border border-border rounded-xl p-3.5 cursor-grab active:cursor-grabbing select-none transition-all shadow-sm ${
                        draggingId === card.id ? 'opacity-35 scale-95 shadow-none' : 'hover:shadow-md'
                      }`}>

                      <div className="flex items-start gap-2.5 mb-2.5">
                        <GripVertical size={13} className="text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                          <Icon size={13} className={s.iconTxt} />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${s.badgeTxt}`}>{card.severity}</span>
                          <span className="text-[10px] text-muted-foreground">{typeLabel[card.type]}</span>
                        </div>
                      </div>

                      <p className="text-sm text-foreground leading-snug mb-2 pl-0.5">{card.message}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3"><Clock size={10} />{card.time}</p>

                      <div className="flex gap-1.5">
                        {col.id === 'open' && (
                          <>
                            <button onClick={() => moveCard(card.id, 'disputed')}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold border border-[#ffd9a8] bg-[#fbf1dd] text-[#b07a1a] hover:bg-[#ffdad6] transition-colors">
                              <Flag size={10} />Dispute
                            </button>
                            <button onClick={() => moveCard(card.id, 'resolved')}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                              <Check size={10} />Resolve
                            </button>
                          </>
                        )}
                        {col.id === 'disputed' && (
                          <>
                            <button onClick={() => moveCard(card.id, 'open')}
                              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border border-border text-muted-foreground hover:bg-muted transition-colors">
                              ← Reopen
                            </button>
                            <button onClick={() => moveCard(card.id, 'resolved')}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold bg-[#1f8f5c] text-white hover:opacity-90 transition-opacity">
                              <Check size={10} />Resolved
                            </button>
                          </>
                        )}
                        {col.id === 'resolved' && (
                          <button onClick={() => moveCard(card.id, 'open')}
                            className="w-full py-1.5 rounded-lg text-[11px] font-bold border border-border text-muted-foreground hover:bg-muted transition-colors">
                            Reopen Incident
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colCards.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                    <CheckCircle size={22} className="text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">No incidents</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
