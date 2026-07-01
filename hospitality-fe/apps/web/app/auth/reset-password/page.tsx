'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import { initSuperTokens } from '../../config/supertokens';
import { API_BASE_URL } from '@hospitality-saas/constants';

// Run initialization in client environment
initSuperTokens();

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalErr, setGeneralErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAlreadyActive, setIsAlreadyActive] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (!token) {
      setGeneralErr('Invalid or missing invitation token. Please check your link or request a new invite.');
      setCheckingStatus(false);
      return;
    }

    async function checkUserStatus() {
      if (!email) {
        setCheckingStatus(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/status?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ACTIVE') {
            setIsAlreadyActive(true);
          }
        }
      } catch (err) {
        console.error('Failed to verify activation status:', err);
      } finally {
        setCheckingStatus(false);
      }
    }

    checkUserStatus();
  }, [token, email]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!password) {
      e.password = 'Password is required';
    } else if (password.length < 6) {
      e.password = 'Password must be at least 6 characters long';
    }
    if (password !== confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralErr(null);

    if (!token) {
      setGeneralErr('Cannot reset password without a valid token.');
      return;
    }

    const formErrs = validate();
    if (Object.keys(formErrs).length) {
      setErrors(formErrs);
      return;
    }

    setLoading(true);
    try {
      const response = await EmailPassword.submitNewPassword({
        formFields: [
          { id: 'password', value: password }
        ]
      });

      if (response.status === 'OK') {
        setSuccess(true);
        // Automatically redirect to login page after 3 seconds
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else if (response.status === 'RESET_PASSWORD_INVALID_TOKEN_ERROR') {
        setGeneralErr('The invitation link has expired or is invalid. Please contact your administrator.');
      } else {
        setGeneralErr('Failed to set password. Please try again.');
      }
    } catch (err: any) {
      setGeneralErr(err.message || 'A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex text-foreground font-sans">
      {/* Left panel – brand preview */}
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
        </div>
        <p className="text-white/30 text-xs">Hospitality Elite · Enterprise Operations Platform</p>
      </div>

      {/* Right panel – password reset form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Set Your Password</h1>
            <p className="text-muted-foreground mt-1.5">Configure your new secure account password to join the platform.</p>
          </div>

          {checkingStatus ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Verifying token status...
            </div>
          ) : isAlreadyActive ? (
            <div className="bg-[#e6f4ec] border border-[#d2ecdf] rounded-2xl p-6 shadow-sm space-y-4 text-center">
              <div className="w-12 h-12 bg-[#1f8f5c] text-white rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-lg font-bold text-[#1f8f5c]">Password Already Set!</h2>
              <p className="text-sm text-[#2a6d4e]">
                Your account is already active. You can log in directly using your email and password.
              </p>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-[#1f8f5c] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Go to Sign In
                <ArrowRight size={16} />
              </button>
            </div>
          ) : success ? (
            <div className="bg-[#e6f4ec] border border-[#d2ecdf] rounded-2xl p-6 shadow-sm space-y-3 text-center">
              <div className="w-12 h-12 bg-[#1f8f5c] text-white rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-lg font-bold text-[#1f8f5c]">Password Set Successfully!</h2>
              <p className="text-sm text-[#2a6d4e]">
                Your password has been configured. You are being redirected to the sign-in page to log in…
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
              {generalErr && (
                <div className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-3.5 flex items-center gap-2.5 mb-5">
                  <AlertCircle size={15} className="text-[#b23a3a] flex-shrink-0" />
                  <p className="text-sm text-[#7a2828]">{generalErr}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      disabled={!token || loading}
                      className={`w-full bg-secondary border rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
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
                      <AlertCircle size={11} />{errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      disabled={!token || loading}
                      className={`w-full bg-secondary border rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
                        errors.confirmPassword ? 'border-[#b23a3a] focus:ring-[#b23a3a]/20' : 'border-border focus:ring-[#151515]/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-[#b23a3a] mt-1.5 flex items-center gap-1">
                      <AlertCircle size={11} />{errors.confirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!token || loading}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 mt-4"
                >
                  {loading ? 'Setting Password…' : 'Set Password'}
                </button>
              </form>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">Hospitality Elite · Enterprise Operations Platform</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm font-sans">Loading invitation details...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
