'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Session from 'supertokens-web-js/recipe/session';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      try {
        const sessionExists = await Session.doesSessionExist();
        if (!sessionExists) {
          router.push('/');
        } else {
          setAuthenticated(true);
        }
      } catch (err) {
        console.error('Session verification error:', err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground font-sans">
        <div className="w-10 h-10 border-4 border-t-primary border-r-border border-b-border border-l-border rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground mt-4">Verifying session...</p>
      </div>
    );
  }

  return authenticated ? <>{children}</> : null;
}
