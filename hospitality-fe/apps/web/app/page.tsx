'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth';
import { LoginSchema } from '@hospitality-saas/validation';
import { Mail, Lock, Eye, EyeOff, AlertTriangle, Zap } from 'lucide-react';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

export default function LoginPage() {
  const router = useRouter();
  const { login, apiClient, accessToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalErr, setGeneralErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const Session = (await import('supertokens-web-js/recipe/session')).default;
        const exists = await Session.doesSessionExist();
        if (exists && accessToken) {
          router.push('/dashboard');
        }
      } catch (e) {
        console.error("Session check error on login page:", e);
      }
    }
    checkSession();
  }, [accessToken, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email) {
      e.email = 'Email is required';
    } else {
      const result = LoginSchema.safeParse({ email, password: 'dummy_password' });
      if (!result.success) {
        const emailErr = result.error.errors.find(err => err.path.includes('email'));
        if (emailErr) e.email = emailErr.message;
      }
    }
    if (!password) {
      e.password = 'Password is required';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralErr(null);

    const formErrs = validate();
    if (Object.keys(formErrs).length) {
      setErrors(formErrs);
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in via SuperTokens EmailPassword recipe
      const response = await EmailPassword.signIn({
        formFields: [
          { id: 'email', value: email },
          { id: 'password', value: password }
        ]
      });

      if (response.status === 'OK') {
        // 2. Fetch user profile client-side so the browser includes the freshly-set session cookie
        const meRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (!meRes.ok) {
          throw new Error('Failed to fetch user profile after login.');
        }
        const userProfile = await meRes.json();
        
        // 3. Update Zustand Store with user profile and dummy tokens (cookies manage actual auth)
        login({
          accessToken: 'supertokens-active',
          refreshToken: 'supertokens-active',
          user: userProfile
        });
        
        // 4. Redirect to Dashboard
        router.push('/dashboard');
      } else if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        setGeneralErr('Invalid email or password. Please try again.');
      } else {
        setGeneralErr('Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setGeneralErr(err?.message || 'A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex text-foreground font-sans">
      {/* Left brand panel – desktop only */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Hospitality Elite</span>
        </div>
        <div>
          <blockquote className="text-white/80 text-lg leading-relaxed italic mb-6">
            "The same operational intelligence that only enterprise groups could afford — delivered to every venue."
          </blockquote>
          <div className="flex gap-4">
            {[{ n: "28", l: "Open incidents" }, { n: "€14.8k", l: "Monthly spend" }, { n: "31.4%", l: "Labor ratio" }].map((s) => (
              <div key={s.l}>
                <div className="text-white text-xl font-semibold">{s.n}</div>
                <div className="text-white/40 text-xs mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">Hospitality Elite · Enterprise Operations Platform</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Zap size={22} className="text-accent" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Hospitality Elite</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-1.5">Sign in to continue to your dashboard</p>
          </div>

          {/* General error */}
          {generalErr && (
            <div className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-3.5 flex items-center gap-2.5 mb-5">
              <AlertTriangle size={15} className="text-[#b23a3a] flex-shrink-0" />
              <p className="text-sm text-[#7a2828]">{generalErr}</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@venue.com"
                    className={`w-full bg-secondary border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
                      errors.email ? 'border-[#b23a3a] focus:ring-[#b23a3a]/20' : 'border-border focus:ring-[#151515]/15'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-[#b23a3a] mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} />{errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-secondary border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
                      errors.password ? 'border-[#b23a3a] focus:ring-[#b23a3a]/20' : 'border-border focus:ring-[#151515]/15'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-[#b23a3a] mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} />{errors.password}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center text-xs mt-2">
                <div className="text-muted-foreground">
                  Demo: <span className="font-semibold text-foreground">manager@venue.com / 123456</span>
                </div>
                <button type="button" className="text-accent font-medium hover:underline">Forgot password?</button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 mt-4"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>

          <div className="flex justify-center items-center gap-1 text-sm mt-6">
            <span className="text-muted-foreground">Don't have an account?</span>
            <button 
              type="button"
              onClick={() => router.push('/auth/register')} 
              className="text-primary font-semibold hover:underline"
            >
              Register workspace
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">Hospitality Elite · Enterprise Operations Platform</p>
        </div>
      </div>
    </div>
  );
}
