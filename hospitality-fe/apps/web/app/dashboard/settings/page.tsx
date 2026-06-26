'use client';

import React, { useState } from 'react';
import { Badge, Btn, Toggle } from '../_components/ui';

export default function SettingsPage() {
  const [notifs, setNotifs] = useState(true);
  const [weekly, setWeekly] = useState(true);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl font-sans">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-6">Settings</h1>
      <div className="space-y-5">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-foreground">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-semibold flex-shrink-0">GM</div>
            <div>
              <p className="font-semibold text-foreground">General Manager</p>
              <p className="text-sm text-muted-foreground">manager@venue.com</p>
              <Badge variant="info">MANAGER</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Name', 'General Manager'],
              ['Email', 'manager@venue.com']
            ].map(([l, v]) => (
              <div key={l}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label>
                <input className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#151515]/15 dark:focus:ring-white/10" defaultValue={v} />
              </div>
            ))}
          </div>
          <Btn size="sm">Save Changes</Btn>
        </div>

        {/* Hiding Appearance settings (dark mode is disabled)
        <div className="bg-card rounded-xl border border-border p-5 space-y-3 shadow-sm">
          <h2 className="font-semibold text-foreground">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Dark mode</p>
              <p className="text-xs text-muted-foreground">Switch interface color theme</p>
            </div>
            <Toggle on={dark} onToggle={() => setDark(!dark)} />
          </div>
        </div>
        */}

        <div className="bg-card rounded-xl border border-border p-5 space-y-3 shadow-sm">
          <h2 className="font-semibold text-foreground">Notifications</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Incident alerts</p>
              <p className="text-xs text-muted-foreground">Price spikes, labor thresholds, waste</p>
            </div>
            <Toggle on={notifs} onToggle={() => setNotifs(!notifs)} />
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Weekly report</p>
              <p className="text-xs text-muted-foreground">Summary of spend, margins, labor</p>
            </div>
            <Toggle on={weekly} onToggle={() => setWeekly(!weekly)} />
          </div>
        </div>
      </div>
    </div>
  );
}
