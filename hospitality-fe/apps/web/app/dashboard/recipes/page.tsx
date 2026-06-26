'use client';

import React, { useState } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { recipes, recipeIngredientMap, defaultIngredients } from '../mockData';
import { Badge } from '../_components/ui';

export default function RecipesPage() {
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = (name: string) => { setSelectedRecipe(name); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); };

  const recipe = selectedRecipe ? recipes.find((r) => r.name === selectedRecipe) : null;
  const ingredients = selectedRecipe ? (recipeIngredientMap[selectedRecipe] || defaultIngredients) : [];
  const totalCost = ingredients.reduce((s, ing) => s + ing.portionCost, 0);
  const actualMargin = recipe ? (100 - recipe.costPct).toFixed(1) : '0';
  const targetMargin = recipe ? (100 - recipe.target).toFixed(1) : '0';
  const marginOver = recipe ? recipe.costPct > recipe.target : false;

  const statusStyle = (st: string) => {
    if (st === 'critical') return { badge: 'error' as const, label: 'Critical Margin Alert' };
    if (st === 'warning') return { badge: 'warning' as const, label: 'Warning' };
    return { badge: 'success' as const, label: 'Margin Stable' };
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl font-sans">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Recipes Costing Board</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track ingredient costs against pricing baseline.</p>
      </div>

      {/* Desktop Table view */}
      <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Recipe', 'Sale Price', 'Cost %', 'Target %', 'Portion Cost', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recipes.map((r) => {
              const s = statusStyle(r.status);
              return (
                <tr key={r.name} onClick={() => openDrawer(r.name)} className="hover:bg-muted/20 transition-colors cursor-pointer group">
                  <td className="px-4 py-3.5"><span className="text-sm font-medium text-foreground">{r.name}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-foreground">€{r.sale.toFixed(2)}</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-semibold ${
                      r.status === 'critical' ? 'text-[#b23a3a]' : r.status === 'warning' ? 'text-[#b07a1a]' : 'text-foreground'
                    }`}>
                      {r.costPct}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><span className="text-sm text-muted-foreground">{r.target}%</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-foreground font-mono">€{r.portionCost.toFixed(2)}</span></td>
                  <td className="px-4 py-3.5"><Badge variant={s.badge}>{s.label}</Badge></td>
                  <td className="px-4 py-3.5"><TrendingDown size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards view */}
      <div className="md:hidden space-y-3">
        {recipes.map((r) => {
          const s = statusStyle(r.status);
          return (
            <button key={r.name} onClick={() => openDrawer(r.name)} className="w-full bg-card rounded-xl border border-border p-4 text-left shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-foreground">{r.name}</span>
                <Badge variant={s.badge}>{s.label}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div><div className="text-xs text-muted-foreground mb-0.5">Sale</div><div className="text-sm font-medium text-foreground">€{r.sale.toFixed(2)}</div></div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Cost %</div>
                  <div className={`text-sm font-semibold ${r.status === 'critical' ? 'text-[#b23a3a]' : r.status === 'warning' ? 'text-[#b07a1a]' : 'text-foreground'}`}>{r.costPct}%</div>
                </div>
                <div><div className="text-xs text-muted-foreground mb-0.5">Target</div><div className="text-sm text-muted-foreground">{r.target}%</div></div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Drawer overlay */}
      {drawerOpen && <div className="fixed inset-0 bg-black/40 z-40" onClick={closeDrawer} />}

      {/* Ingredient Drawer */}
      {selectedRecipe && (
        <div className={`fixed z-50 bg-card shadow-2xl border-border transition-all duration-300 flex flex-col md:top-0 md:right-0 md:h-full md:w-[480px] md:border-l bottom-0 left-0 right-0 max-h-[90vh] rounded-t-3xl border-t md:rounded-none md:max-h-none ${
          drawerOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0'
        }`}>
          {/* Drawer Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-foreground">{selectedRecipe}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recipe Portion Cost & Supplier Analytics</p>
            </div>
            <button onClick={closeDrawer} className="p-1.5 hover:bg-muted rounded-lg transition-colors font-semibold">✕</button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Margin alert */}
            {recipe && recipe.status === 'critical' && (
              <div className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-4 flex gap-3">
                <AlertTriangle size={16} className="text-[#b23a3a] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#7a2828]">Margin Warning</h4>
                  <p className="text-xs text-[#7a2828] mt-0.5 leading-relaxed">
                    Actual recipe margin is <strong>{actualMargin}%</strong>, which is <strong>{(parseFloat(targetMargin) - parseFloat(actualMargin)).toFixed(1)}%</strong> below target. High supplier cost of Limoncello is the primary driver.
                  </p>
                </div>
              </div>
            )}

            {/* KPI metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sale Price', value: `€${recipe?.sale.toFixed(2)}`, sub: 'Baseline' },
                { label: 'Portion Cost', value: `€${totalCost.toFixed(2)}`, sub: 'Calculated' },
                { label: 'Actual Margin', value: `${actualMargin}%`, sub: `Target ${targetMargin}%`, err: marginOver }
              ].map((k) => (
                <div key={k.label} className="bg-muted/40 rounded-xl p-3 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{k.label}</span>
                  <div className={`text-sm font-bold mt-1 font-mono ${k.err ? 'text-[#b23a3a]' : 'text-foreground'}`}>{k.value}</div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">{k.sub}</span>
                </div>
              ))}
            </div>

            {/* Ingredients list */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Portion Ingredients</h3>
              <div className="space-y-2">
                {ingredients.map((ing, i) => (
                  <div key={i} className="bg-muted/15 border border-border rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{ing.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ing.supplier} · {ing.portion}</p>
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1.5 inline-block">{ing.unitPrice}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground font-mono">€{ing.portionCost.toFixed(2)}</div>
                      {ing.priceChange > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#b23a3a] font-semibold mt-1">
                          <TrendingUp size={10} />+{ing.priceChange}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#1f8f5c] font-semibold mt-1 block">Stable</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
