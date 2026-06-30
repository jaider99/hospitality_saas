'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import { Mail, Lock, User as UserIcon, Phone, Eye, EyeOff, AlertTriangle, Zap, Shield, ChevronRight } from 'lucide-react';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

export default function RegisterPage() {
  const router = useRouter();
  const { login, apiClient, accessToken } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const role = 'SUPER_ADMIN';
  const [restaurantName, setRestaurantName] = useState('');
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
        console.error("Session check error on register page:", e);
      }
    }
    checkSession();
  }, [accessToken, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!email.trim()) {
      e.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      e.email = 'Invalid email address';
    }
    if (!restaurantName.trim()) {
      e.restaurantName = 'Restaurant name is required';
    }
    if (!password) {
      e.password = 'Password is required';
    } else if (password.length < 6) {
      e.password = 'Password must be at least 6 characters';
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
      // 1. Sign up via SuperTokens EmailPassword recipe
      const response = await EmailPassword.signUp({
        formFields: [
          { id: 'email', value: email },
          { id: 'password', value: password }
        ],
        userContext: {
          role: 'SUPER_ADMIN',
          first_name: firstName,
          last_name: lastName,
          phone: phone || undefined,
          restaurant_name: restaurantName
        }
      });

      if (response.status === 'OK') {
        // 2. Fetch authenticated user profile details from PostgreSQL
        const userProfile = await apiClient.getMe();
        
        // 3. Update Zustand Store with user profile
        login({
          accessToken: 'supertokens-active',
          refreshToken: 'supertokens-active',
          user: userProfile
        });
        
        // 4. Redirect to Dashboard
        router.push('/dashboard');
      } else if (response.status === 'FIELD_ERROR') {
        const emailErr = response.formFields.find(f => f.id === 'email');
        const pwdErr = response.formFields.find(f => f.id === 'password');
        const newErrors: Record<string, string> = {};
        
        if (emailErr) newErrors.email = emailErr.error;
        if (pwdErr) newErrors.password = pwdErr.error;
        
        if (Object.keys(newErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...newErrors }));
        } else {
          setGeneralErr('Registration failed. Please check the fields.');
        }
      } else if (response.status === 'SIGN_UP_NOT_ALLOWED') {
        setGeneralErr('This email address is already registered. Please sign in instead.');
      } else {
        setGeneralErr('Registration failed. Email might already be registered.');
      }
    } catch (err: any) {
      setGeneralErr(err.response?.data?.message || err.message || 'An error occurred during registration.');
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
            "Create your restaurant workspace owner account and start managing your venue's staff, recipes, invoices, and analytics in real-time."
          </blockquote>
          <div className="flex gap-4">
            {[{ n: "100%", l: "Data security" }, { n: "Real-time", l: "OCR extraction" }, { n: "Multi-role", l: "RBAC ready" }].map((s) => (
              <div key={s.l}>
                <div className="text-white text-base font-semibold">{s.n}</div>
                <div className="text-white/40 text-[11px] mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">Hospitality Elite · Enterprise Operations Platform</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Zap size={22} className="text-accent" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Hospitality Elite</h1>
            <p className="text-sm text-muted-foreground mt-1">Register your account</p>
          </div>

          <div className="hidden lg:block mb-6">
            <h1 className="text-3xl font-semibold text-foreground">Get started</h1>
            <p className="text-muted-foreground mt-1.5">Register a new restaurant workspace as the Owner</p>
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
              
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">First name</label>
                  <div className="relative">
                    <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className={`w-full bg-secondary border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
                        errors.firstName ? 'border-[#b23a3a] focus:ring-[#b23a3a]/20' : 'border-border focus:ring-[#151515]/15'
                      }`}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="text-xs text-[#b23a3a] mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={11} />{errors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Last name</label>
                  <div className="relative">
                    <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className={`w-full bg-secondary border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
                        errors.lastName ? 'border-[#b23a3a] focus:ring-[#b23a3a]/20' : 'border-border focus:ring-[#151515]/15'
                      }`}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="text-xs text-[#b23a3a] mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={11} />{errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@venue.com"
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

              {/* Phone */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Phone number (optional)</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full bg-secondary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151515]/15 transition-shadow placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Restaurant Name */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Restaurant Name</label>
                <div className="relative">
                  <Zap size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g. Le Bistro Parisien"
                    className={`w-full bg-secondary border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground ${
                      errors.restaurantName ? 'border-[#b23a3a] focus:ring-[#b23a3a]/20' : 'border-border focus:ring-[#151515]/15'
                    }`}
                  />
                </div>
                {errors.restaurantName && (
                  <p className="text-xs text-[#b23a3a] mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} />{errors.restaurantName}
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 mt-6"
              >
                {loading ? "Registering Workspace…" : "Register Account"}
              </button>
            </form>
          </div>

          {/* Footer Navigation */}
          <div className="flex justify-center items-center gap-1 text-sm mt-6">
            <span className="text-muted-foreground">Already have an account?</span>
            <button 
              type="button"
              onClick={() => router.push('/')} 
              className="text-primary font-semibold hover:underline inline-flex items-center"
            >
              Sign in <ChevronRight size={14} className="mt-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
