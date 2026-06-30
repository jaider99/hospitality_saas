'use client';

import React, { useEffect } from 'react';
import { initSuperTokens } from '../config/supertokens';
import { useAuthStore } from '../../store/auth';

// Run initialization in client environment
initSuperTokens();

export function SuperTokensProvider({ children }: { children: React.ReactNode }) {
  const { logout } = useAuthStore();

  useEffect(() => {
    async function syncSession() {
      try {
        const Session = (await import('supertokens-web-js/recipe/session')).default;
        const exists = await Session.doesSessionExist();
        if (!exists) {
          // If no SuperTokens session exists, clear any stale state from localStorage/Zustand
          logout();
        }
      } catch (err) {
        console.error("Error synchronizing session state:", err);
      }
    }
    syncSession();
  }, [logout]);

  return <>{children}</>;
}
