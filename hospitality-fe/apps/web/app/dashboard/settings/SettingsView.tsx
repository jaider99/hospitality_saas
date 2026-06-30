'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/auth';
import { Badge, Toggle } from '../_components/ui';
import { 
  Users, 
  Settings as SettingsIcon, 
  UserPlus, 
  Shield, 
  AlertCircle, 
  CheckCircle2, 
  Phone, 
  Mail, 
  User as UserIcon,
  Send,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  Lock,
} from 'lucide-react';
import {
  updateRestaurantAction,
  createUserAction,
  resendInviteAction,
  updateUserStatusAction,
  getUsersAction,
  getRestaurantAction
} from './actions';

interface SettingsViewProps {
  initialRestaurant: any;
  initialUsers: {
    items: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export default function SettingsView({ initialRestaurant, initialUsers }: SettingsViewProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'restaurant'>('profile');
  
  // Notification States (Settings placeholders)
  const [notifs, setNotifs] = useState(true);
  const [weekly, setWeekly] = useState(true);

  // Team Management States
  const [users, setUsers] = useState<any[]>(initialUsers.items || []);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Pagination States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [total, setTotal] = useState(initialUsers.total || 0);
  const [totalPages, setTotalPages] = useState(initialUsers.pages || 0);

  // Invite Form Fields (no password — invite link is emailed)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER'>('MANAGER');

  // Error/Success Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Restaurant States
  const [restaurant, setRestaurant] = useState<any>(initialRestaurant);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [resName, setResName] = useState(initialRestaurant?.name || '');
  const [resAddress, setResAddress] = useState(initialRestaurant?.address || '');
  const [resPhone, setResPhone] = useState(initialRestaurant?.phone || '');
  const [resEmail, setResEmail] = useState(initialRestaurant?.email || '');
  const [resTaxId, setResTaxId] = useState(initialRestaurant?.tax_id || '');
  const [resCurrency, setResCurrency] = useState(initialRestaurant?.currency || 'EUR');
  const [resTimezone, setResTimezone] = useState(initialRestaurant?.timezone || 'UTC');
  const [resOpStatus, setResOpStatus] = useState(initialRestaurant?.operational_status || 'OPEN');

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await getUsersAction({
        search: debouncedSearch || undefined,
        page,
        limit
      });
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err: any) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRestaurant = async () => {
    setLoadingRestaurant(true);
    try {
      const data = await getRestaurantAction();
      setRestaurant(data);
      setResName(data.name || '');
      setResAddress(data.address || '');
      setResPhone(data.phone || '');
      setResEmail(data.email || '');
      setResTaxId(data.tax_id || '');
      setResCurrency(data.currency || 'EUR');
      setResTimezone(data.timezone || 'UTC');
      setResOpStatus(data.operational_status || 'OPEN');
    } catch (err) {
      console.error("Failed to load restaurant details:", err);
    } finally {
      setLoadingRestaurant(false);
    }
  };

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const updated = await updateRestaurantAction({
        name: resName,
        address: resAddress || undefined,
        phone: resPhone || undefined,
        email: resEmail || undefined,
        tax_id: resTaxId || undefined,
        currency: resCurrency,
        timezone: resTimezone,
        operational_status: resOpStatus
      });
      setRestaurant(updated);
      setSuccessMsg("✅ Restaurant settings updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update restaurant settings.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'team') {
      fetchUsers();
    } else if (activeTab === 'restaurant') {
      fetchRestaurant();
    }
  }, [activeTab, page, limit, debouncedSearch]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!firstName || !lastName || !email) {
      setErrorMsg("First Name, Last Name, and Email are required.");
      return;
    }

    setSubmitting(true);
    try {
      await createUserAction({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        role,
        restaurant_id: user?.restaurant_id || undefined
      });

      setSuccessMsg(
        `✅ Invite sent to ${email}! They'll receive an email to set their password and join as ${role}.`
      );
      // Clear form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRole('MANAGER');

      // Refresh list
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send invite. Make sure the email is not already registered.");
    } finally {
      setSubmitting(false);
    }
  };

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const handleResendInvite = async (userId: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await resendInviteAction(userId);
      setSuccessMsg("✅ Invitation link resent successfully!");
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend invitation.");
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const newStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    
    // Simple confirmation dialog
    const confirmMsg = newStatus === 'INACTIVE' 
      ? "Are you sure you want to deactivate this team member? They will no longer be able to log in."
      : "Are you sure you want to reactivate this team member?";
      
    if (!window.confirm(confirmMsg)) {
      return;
    }
    
    try {
      await updateUserStatusAction(userId, newStatus);
      setSuccessMsg(`✅ User status updated to ${newStatus} successfully!`);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update user status.");
    }
  };

  const statusConfig = (status: string) => {
    switch (status) {
      case 'ACTIVE':   return { color: 'text-[#1f8f5c]', dot: 'bg-[#1f8f5c]', label: 'Active' };
      case 'INVITED':  return { color: 'text-[#b07a1a]', dot: 'bg-[#b07a1a]', label: 'Invited' };
      case 'INACTIVE': return { color: 'text-[#b23a3a]', dot: 'bg-[#b23a3a]', label: 'Inactive' };
      default:         return { color: 'text-muted-foreground', dot: 'bg-muted-foreground', label: status };
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl font-sans w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your personal profile and manage team access controls.</p>
        </div>
        <div className="flex bg-muted rounded-lg p-1 mt-4 sm:mt-0 w-full sm:w-auto max-w-md border border-border/50">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'profile'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SettingsIcon size={16} />
            General
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'team'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users size={16} />
            Team
          </button>
          <button
            onClick={() => setActiveTab('restaurant')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'restaurant'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap size={16} />
            Restaurant
          </button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <UserIcon size={18} className="text-muted-foreground" />
              Profile Details
            </h2>
            <div className="flex items-center gap-4 border-b border-border/50 pb-4">
              <div className="w-14 h-14 bg-[#151515] text-white dark:bg-[#efede7] dark:text-[#14130f] rounded-full flex items-center justify-center text-xl font-bold">
                {user?.first_name?.[0] || user?.name?.[0] || 'U'}
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{user?.name || 'User Profile'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-1">
                  <Badge variant={user?.role === 'ADMIN' ? 'success' : 'info'}>{user?.role || 'STAFF'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">First Name</label>
                <input className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={user?.first_name || user?.name?.split(' ')[0] || ''} disabled />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Last Name</label>
                <input className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={user?.last_name || user?.name?.split(' ')[1] || ''} disabled />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                <input className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={user?.email || ''} disabled />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone</label>
                <input className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={user?.phone || 'Not configured'} disabled />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Incident alerts</p>
                <p className="text-xs text-muted-foreground">Price spikes, labor thresholds, waste</p>
              </div>
              <Toggle on={notifs} onToggle={() => setNotifs(!notifs)} />
            </div>
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Weekly report</p>
                <p className="text-xs text-muted-foreground">Summary of spend, margins, labor</p>
              </div>
              <Toggle on={weekly} onToggle={() => setWeekly(!weekly)} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">

          {/* Invite Form */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <UserPlus size={18} className="text-muted-foreground" />
                Invite Team Member
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                An invite email will be sent with a secure link to set their password.
              </p>
            </div>

            {!canManage ? (
              <div className="bg-[#fdf3f3] text-[#b23a3a] dark:bg-[#b23a3a]/10 dark:text-[#ff8080] border border-[#fceaea]/50 rounded-lg p-4 flex gap-3 items-start text-sm">
                <Shield size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Access Restricted</span>
                  Only administrators and restaurant owners can invite and register new team members. Please contact your system administrator.
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteUser} className="space-y-4">
                {errorMsg && (
                  <div className="bg-[#fdf3f3] text-[#b23a3a] border border-[#fceaea] rounded-lg p-3 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-[#e6f4ec] text-[#1f8f5c] border border-[#d2ecdf] rounded-lg p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {successMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">First Name *</label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Last Name *</label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address *</label>
                    <input
                      type="email"
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. john.doe@venue.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. +1 (555) 019-2834"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">System Role *</label>
                    {user?.role === 'SUPER_ADMIN' ? (
                      <select
                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MANAGER')}
                      >
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none text-muted-foreground"
                        value="MANAGER"
                        disabled
                      />
                    )}
                  </div>
                </div>

                {/* Info banner */}
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg p-3 flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Mail size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    A secure invite email will be sent to the address above. The recipient will click the link to set their own password — <strong>no password needed from you</strong>.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-lg leading-none disabled:opacity-60 cursor-pointer text-sm px-5 py-2.5 bg-[#151515] text-white hover:opacity-90 dark:bg-[#efede7] dark:text-[#14130f]"
                >
                  <Send size={14} />
                  {submitting ? 'Sending Invite…' : 'Send Invite'}
                </button>
              </form>
            )}
          </div>

          {/* Team Members List */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            
            {/* Header controls with Search and Pagination limits */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-muted-foreground" />
                  Team Members ({total})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage system access roles, user states, and activation parameters.</p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-secondary/40 border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground text-foreground"
                  />
                </div>
                
                {/* Limit selector */}
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  <span>Show:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
                
                <button onClick={fetchUsers} className="text-xs text-primary hover:underline font-medium">
                  Refresh
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Loading team members…</div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No team members found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-2">Member</th>
                      <th className="py-3 px-2">Role</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2">Timeline</th>
                      <th className="py-3 px-2">Contact</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-sm">
                    {users.map((member) => {
                      const s = statusConfig(member.status);
                      return (
                        <tr key={member.id} className="hover:bg-secondary/10 animate-fade-in">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center font-bold text-muted-foreground uppercase">
                                {member.first_name?.[0] || member.name?.[0] || 'U'}
                              </div>
                              <div>
                                <span className="font-semibold text-foreground block">{member.name}</span>
                                <span className="text-xs text-muted-foreground block">{member.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant={member.role === 'ADMIN' ? 'success' : 'info'}>
                              {member.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.color}`}>
                              {member.status === 'INVITED'
                                ? <Clock size={12} />
                                : <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              }
                              {s.label}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground space-y-1">
                            {member.status === 'INVITED' && member.invitation_sent_at && (
                              <div>
                                <span className="block font-medium text-foreground">Sent: {new Date(member.invitation_sent_at).toLocaleDateString()}</span>
                                <span className="block text-[10px] text-muted-foreground">Expires: {new Date(member.invitation_expires_at).toLocaleDateString()}</span>
                              </div>
                            )}
                            {member.status === 'ACTIVE' && (
                              <div>
                                <span className="block text-foreground/80 font-medium">Registered Member</span>
                                {member.last_login_at && (
                                  <span className="block text-[10px] text-muted-foreground">Last login: {new Date(member.last_login_at).toLocaleDateString()}</span>
                                )}
                              </div>
                            )}
                            {member.status === 'INACTIVE' && (
                              <span className="block text-red-500 font-medium">Deactivated</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground space-y-1">
                            {member.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone size={12} />
                                {member.phone}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Mail size={12} />
                              {member.email}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right space-x-1.5 whitespace-nowrap">
                            {canManage && member.email !== user?.email && (user?.role === 'SUPER_ADMIN' || member.role === 'MANAGER') && (
                              <>
                                {(member.status === 'INVITED' || member.status === 'INACTIVE') && (
                                  <button
                                    onClick={() => handleResendInvite(member.id)}
                                    className="inline-flex items-center justify-center text-xs font-semibold px-2.5 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer"
                                  >
                                    Resend
                                  </button>
                                )}
                                {(member.status === 'ACTIVE' || member.status === 'INVITED') && (
                                  <button
                                    onClick={() => handleToggleStatus(member.id, member.status)}
                                    className="inline-flex items-center justify-center text-xs font-semibold px-2.5 py-1.5 bg-[#fdf3f3] text-[#b23a3a] hover:bg-[#fceaea] rounded-lg border border-[#fceaea] transition-colors cursor-pointer"
                                  >
                                    Deactivate
                                  </button>
                                )}
                                {member.status === 'INACTIVE' && (
                                  <button
                                    onClick={() => handleToggleStatus(member.id, member.status)}
                                    className="inline-flex items-center justify-center text-xs font-semibold px-2.5 py-1.5 bg-[#e6f4ec] text-[#1f8f5c] hover:bg-[#d2ecdf] rounded-lg border border-[#d2ecdf] transition-colors cursor-pointer"
                                  >
                                    Activate
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loadingUsers && users.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/50 pt-4 mt-2">
                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{Math.min((page - 1) * limit + 1, total)}</span> to{' '}
                  <span className="font-semibold text-foreground">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-semibold text-foreground">{total}</span> team members
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center p-1.5 bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-border transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`inline-flex items-center justify-center w-8 h-8 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        page === p
                          ? 'bg-[#151515] text-white border-[#151515] dark:bg-[#efede7] dark:text-[#14130f] dark:border-[#efede7] shadow-sm'
                          : 'bg-secondary border-border hover:bg-secondary/80 text-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages || totalPages === 0}
                    className="inline-flex items-center justify-center p-1.5 bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-border transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'restaurant' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Zap size={18} className="text-muted-foreground" />
                  Restaurant Details
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure venue profile, operational status, timezone, and currency.
                </p>
              </div>
              {user?.role !== 'SUPER_ADMIN' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border/50 mt-2 sm:mt-0">
                  <Lock size={12} />
                  Read Only (Owner Only)
                </span>
              )}
            </div>

            {loadingRestaurant ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading restaurant details...</div>
            ) : (
              <form onSubmit={handleUpdateRestaurant} className="space-y-6">
                {errorMsg && (
                  <div className="bg-[#fdf3f3] text-[#b23a3a] border border-[#fceaea] rounded-lg p-3 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-[#f2faf5] text-[#1f8f5c] border border-[#eafcf2] rounded-lg p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {successMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Restaurant Name *</label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={resName}
                      onChange={(e) => setResName(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Tax ID / Business Number</label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. BE0123456789"
                      value={resTaxId}
                      onChange={(e) => setResTaxId(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact Email</label>
                    <input
                      type="email"
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. contact@venue.com"
                      value={resEmail}
                      onChange={(e) => setResEmail(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact Phone</label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. +32 2 123 4567"
                      value={resPhone}
                      onChange={(e) => setResPhone(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Address</label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. 123 Operational Way, Brussels"
                      value={resAddress}
                      onChange={(e) => setResAddress(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Base Currency</label>
                    <select
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      value={resCurrency}
                      onChange={(e) => setResCurrency(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Timezone</label>
                    <select
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      value={resTimezone}
                      onChange={(e) => setResTimezone(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    >
                      <option value="UTC">UTC</option>
                      <option value="Europe/Brussels">Europe/Brussels</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Operational Status</label>
                    <select
                      className="w-full bg-secondary/30 disabled:bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      value={resOpStatus}
                      onChange={(e) => setResOpStatus(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                  </div>
                </div>

                {user?.role === 'SUPER_ADMIN' && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-lg leading-none disabled:opacity-60 cursor-pointer text-sm px-5 py-2.5 bg-[#151515] text-white hover:opacity-90 dark:bg-[#efede7] dark:text-[#14130f]"
                  >
                    {submitting ? 'Saving Settings...' : 'Save Settings'}
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
