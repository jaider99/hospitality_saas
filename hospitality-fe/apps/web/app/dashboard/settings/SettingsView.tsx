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
  Building,
  DollarSign,
  TrendingUp,
  Package,
  Utensils,
  ShoppingBag,
  CheckSquare,
  Layers,
  UserCheck,
  Bell,
  Fingerprint,
  X
} from 'lucide-react';
import {
  updateRestaurantAction,
  createUserAction,
  resendInviteAction,
  updateUserStatusAction,
  getUsersAction,
  getRestaurantAction,
  getRolePermissionsAction,
  updateRolePermissionsAction
} from './actions';

import type { User, RolePermissionsMap, SystemRole, RolePermissionPayload, ModulePermission } from '@hospitality-saas/shared-types';

interface SettingsViewProps {
  initialRestaurant: any;
  initialUsers: {
    items: User[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export default function SettingsView({ initialRestaurant, initialUsers }: SettingsViewProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'restaurant'>('profile');

  // Roles & Permissions States
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap | null>(null);
  const [selectedRole, setSelectedRole] = useState<SystemRole>('Administrator');
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Notification States (Settings placeholders)
  const [notifs, setNotifs] = useState(true);
  const [weekly, setWeekly] = useState(true);

  // Team Management States
  const [users, setUsers] = useState<User[]>(initialUsers.items || []);
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
  const [role, setRole] = useState<SystemRole>('Management View');

  // Error/Success Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Open States
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [rolePermissionsModalOpen, setRolePermissionsModalOpen] = useState(false);

  // Restaurant States
  const [_, setRestaurant] = useState<any>(initialRestaurant);
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
      console.error('Failed to load users:', err);
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
      console.error('Failed to load restaurant details:', err);
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
      setSuccessMsg('✅ Restaurant settings updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update restaurant settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchRolePermissions = async () => {
    setLoadingPermissions(true);
    try {
      const data = await getRolePermissionsAction();
      setRolePermissions(data);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'team') {
      fetchUsers();
      fetchRolePermissions();
    } else if (activeTab === 'restaurant') {
      fetchRestaurant();
    }
  }, [activeTab, page, limit, debouncedSearch]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!firstName || !lastName || !email) {
      setErrorMsg('First Name, Last Name, and Email are required.');
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
      setRole('Management View');
      setInviteModalOpen(false);

      // Refresh list
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Failed to send invite. Make sure the email is not already registered.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'Administrator';


  const handleResendInvite = async (userId: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await resendInviteAction(userId);
      setSuccessMsg('✅ Invitation link resent successfully!');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend invitation.');
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const newStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';

    // Simple confirmation dialog
    const confirmMsg =
      newStatus === 'INACTIVE'
        ? 'Are you sure you want to deactivate this team member? They will no longer be able to log in.'
        : 'Are you sure you want to reactivate this team member?';

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await updateUserStatusAction(userId, newStatus);
      setSuccessMsg(`✅ User status updated to ${newStatus} successfully!`);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user status.');
    }
  };

  const statusConfig = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { color: 'text-[#1f8f5c]', dot: 'bg-[#1f8f5c]', label: 'Active' };
      case 'INVITED':
        return { color: 'text-[#b07a1a]', dot: 'bg-[#b07a1a]', label: 'Invited' };
      case 'INACTIVE':
        return { color: 'text-[#b23a3a]', dot: 'bg-[#b23a3a]', label: 'Inactive' };
      default:
        return { color: 'text-muted-foreground', dot: 'bg-muted-foreground', label: status };
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl font-sans w-full space-y-8">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight bg-clip-text bg-gradient-to-r from-foreground to-foreground/75">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Configure venue profiles, customize permission boundaries, and audit team access.
          </p>
        </div>

        {/* Apple-style Glassmorphic Segmented Control */}
        <div className="flex bg-muted/65 backdrop-blur-md rounded-xl p-1 border border-border/80 shadow-inner w-full lg:w-auto overflow-x-auto scrollbar-none">
          <button
            onClick={() => {
              setActiveTab('profile');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <SettingsIcon size={14} />
            General
          </button>
          <button
            onClick={() => {
              setActiveTab('team');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'team'
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users size={14} />
            Team & Invites
          </button>
          <button
            onClick={() => {
              setActiveTab('restaurant');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'restaurant'
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap size={14} />
            Restaurant Settings
          </button>
        </div>
      </div>

      {/* Global Toast Alerts */}
      {successMsg && activeTab === 'profile' && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && activeTab === 'profile' && (
        <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4 text-sm text-red-800 dark:text-red-300 flex items-center gap-2.5 shadow-sm animate-fade-in">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* GENERAL PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-4xl">
          {/* Profile Card */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6 rounded-2xl border border-border/40">
              <div className="relative group">
                <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/10 group-hover:scale-105 transition-transform duration-300">
                  {user?.first_name?.[0] || user?.name?.[0] || 'U'}
                </div>
                <span className="absolute -bottom-1.5 -right-1.5 flex h-4.5 w-4.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4.5 w-4.5 bg-emerald-500 border-2 border-card"></span>
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-foreground tracking-tight">{user?.name}</h3>
                  <Badge variant={user?.role === 'SUPER_ADMIN' ? 'success' : 'info'}>
                    {user?.role}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground/80">
                  Account ID:{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{user?.id}</code>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  First Name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <UserIcon size={14} />
                  </span>
                  <input
                    className="w-full bg-secondary/10 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-muted-foreground focus:outline-none cursor-not-allowed"
                    value={user?.first_name || user?.name?.split(' ')[0] || ''}
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Last Name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <UserIcon size={14} />
                  </span>
                  <input
                    className="w-full bg-secondary/10 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-muted-foreground focus:outline-none cursor-not-allowed"
                    value={user?.last_name || user?.name?.split(' ')[1] || ''}
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <Mail size={14} />
                  </span>
                  <input
                    className="w-full bg-secondary/10 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-muted-foreground focus:outline-none cursor-not-allowed"
                    value={user?.email || ''}
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Contact Phone
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <Phone size={14} />
                  </span>
                  <input
                    className="w-full bg-secondary/10 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-muted-foreground focus:outline-none cursor-not-allowed"
                    value={user?.phone || 'Not configured'}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preferences / Security */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Account Settings & Notifications
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize real-time notification gates and profile security variables.
              </p>
            </div>

            <div className="divide-y divide-border/60">
              <div className="flex items-center justify-between py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-primary/5 rounded-lg text-primary">
                    <Bell size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Real-Time Incident Alerts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Receive instant alerts for price spikes, labor thresholds, and anomalies.
                    </p>
                  </div>
                </div>
                <Toggle on={notifs} onToggle={() => setNotifs(!notifs)} />
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-primary/5 rounded-lg text-primary">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Weekly Digest & Report</p>
                    <p className="text-xs text-muted-foreground">
                      Weekly F&B spend analysis, operating margins, and staff schedules.
                    </p>
                  </div>
                </div>
                <Toggle on={weekly} onToggle={() => setWeekly(!weekly)} />
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-primary/5 rounded-lg text-primary">
                    <Fingerprint size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Two-Factor Authentication (2FA)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Secure your login details using a hardware key or authenticator app.
                    </p>
                  </div>
                </div>
                <Badge variant="neutral">Coming Soon</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEAM & INVITES TAB */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {successMsg && activeTab === 'team' && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm animate-fade-in">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}
          {errorMsg && activeTab === 'team' && (
            <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5 shadow-sm animate-fade-in">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Members Directory */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-muted-foreground" />
                  Team Registry ({total})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Audit active profile parameters, role bindings, and system logins.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {canManage && (
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setInviteModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-sm cursor-pointer transition-all hover:scale-102"
                  >
                    <UserPlus size={14} />
                    Invite Member
                  </button>
                )}

                {/* Configure Role Permissions */}
                {(user?.role === 'SUPER_ADMIN' || user?.role === 'Administrator') && (
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setRolePermissionsModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-secondary border border-border text-foreground hover:bg-muted shadow-sm cursor-pointer transition-all hover:scale-102"
                  >
                    <Shield size={14} />
                    Role Permissions
                  </button>
                )}

                {/* Search Bar */}
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full lg:w-60 bg-secondary/40 border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground text-foreground"
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
                    className="bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                {/* <button
                  type="button"
                  onClick={fetchUsers}
                  className="text-xs font-semibold text-primary hover:underline hover:scale-102 transition-transform cursor-pointer"
                >
                  Refresh Registry
                </button> */}
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading directory...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-xs text-muted-foreground">
                No records matched the current search query.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Access Role</th>
                      <th className="py-3 px-4">Login Status</th>
                      <th className="py-3 px-4">Audit Timeline</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm">
                    {users.map((member) => {
                      const s = statusConfig(member.status);
                      const isSelf = member.email === user?.email;
                      // Dynamic Avatar Color Gradients based on Name hash
                      const gradients = [
                        'from-teal-400 to-emerald-500',
                        'from-indigo-400 to-purple-500',
                        'from-pink-400 to-rose-500',
                        'from-orange-400 to-amber-500'
                      ];
                      const hash = member.name.charCodeAt(0) % gradients.length;
                      const grad = gradients[hash];

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-muted/10 transition-colors duration-150"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 bg-gradient-to-tr ${grad} rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm`}
                              >
                                {member.first_name?.[0] || member.name?.[0] || 'U'}
                              </div>
                              <div>
                                <span className="font-bold text-foreground block">
                                  {member.name}{' '}
                                  {isSelf && (
                                    <code className="ml-1 text-[9px] font-normal uppercase bg-muted/65 text-muted-foreground px-1 py-0.5 rounded">
                                      You
                                    </code>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground block mt-0.5">
                                  {member.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              variant={
                                member.role === 'SUPER_ADMIN' || member.role === 'Administrator'
                                  ? 'success'
                                  : 'info'
                              }
                            >
                              {member.role}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary/80 ${s.color}`}
                            >
                              {member.status === 'INVITED' ? (
                                <Clock size={11} className="text-amber-500" />
                              ) : (
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              )}
                              {s.label}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs text-muted-foreground space-y-1">
                            {member.status === 'INVITED' && member.invitation_sent_at && member.invitation_expires_at && (
                              <div className="leading-snug">
                                <span className="block font-medium text-foreground">
                                  Sent: {new Date(member.invitation_sent_at).toLocaleDateString()}
                                </span>
                                <span className="block text-[10px] text-muted-foreground/80 mt-0.5">
                                  Expires:{' '}
                                  {new Date(member.invitation_expires_at).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {member.status === 'ACTIVE' && (
                              <div className="leading-snug">
                                <span className="block text-foreground/80 font-medium">
                                  Registered User
                                </span>
                                {member.last_login_at && (
                                  <span className="block text-[10px] text-muted-foreground/80 mt-0.5">
                                    Last login: {new Date(member.last_login_at).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}
                            {member.status === 'INACTIVE' && (
                              <span className="block text-red-500 font-semibold">
                                User Deactivated
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {canManage &&
                              !isSelf &&
                              (user?.role === 'SUPER_ADMIN' || member.role !== 'Administrator') && (
                                <>
                                  {(member.status === 'INVITED' ||
                                    member.status === 'INACTIVE') && (
                                    <button
                                      onClick={() => handleResendInvite(member.id)}
                                      className="inline-flex items-center justify-center text-[10px] font-bold tracking-wider uppercase px-2.5 py-1.5 bg-secondary text-foreground hover:bg-muted border border-border rounded-lg transition-all cursor-pointer hover:scale-102"
                                    >
                                      Resend
                                    </button>
                                  )}
                                  {(member.status === 'ACTIVE' || member.status === 'INVITED') && (
                                    <button
                                      onClick={() => handleToggleStatus(member.id, member.status)}
                                      className="inline-flex items-center justify-center text-[10px] font-bold tracking-wider uppercase px-2.5 py-1.5 bg-red-500/10 text-red-600 dark:bg-red-500/5 dark:text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition-all cursor-pointer hover:scale-102"
                                    >
                                      Deactivate
                                    </button>
                                  )}
                                  {member.status === 'INACTIVE' && (
                                    <button
                                      onClick={() => handleToggleStatus(member.id, member.status)}
                                      className="inline-flex items-center justify-center text-[10px] font-bold tracking-wider uppercase px-2.5 py-1.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-all cursor-pointer hover:scale-102"
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 pt-4 mt-2">
                <div className="text-xs text-muted-foreground">
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {Math.min((page - 1) * limit + 1, total)}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-foreground">
                    {Math.min(page * limit, total)}
                  </span>{' '}
                  of <span className="font-semibold text-foreground">{total}</span> team members
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center p-2 bg-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-border transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`inline-flex items-center justify-center w-8 h-8 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        page === p
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-secondary border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages || totalPages === 0}
                    className="inline-flex items-center justify-center p-2 bg-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-border transition-colors cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESTAURANT SETTINGS TAB */}
      {activeTab === 'restaurant' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Building size={18} className="text-muted-foreground" />
                  Restaurant Profile
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure primary operational metrics, timezone rules, and basic billing metadata.
                </p>
              </div>
              {user?.role !== 'SUPER_ADMIN' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground border border-border mt-2 sm:mt-0">
                  <Lock size={11} />
                  Read Only (Owner Restricted)
                </span>
              )}
            </div>

            {loadingRestaurant ? (
              <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading profile data...</span>
              </div>
            ) : (
              <form onSubmit={handleUpdateRestaurant} className="space-y-6">
                {errorMsg && activeTab === 'restaurant' && (
                  <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5">
                    <AlertCircle size={15} className="text-red-500" />
                    <span className="font-medium">{errorMsg}</span>
                  </div>
                )}
                {successMsg && activeTab === 'restaurant' && (
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    <span className="font-medium">{successMsg}</span>
                  </div>
                )}

                {/* Styled Segmented Operational Status Cards */}
                {/* <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                    Operational Status
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        id: 'OPEN',
                        label: 'OPEN',
                        color: 'bg-emerald-500',
                        desc: 'Active operations, accepting scanned invoices and matching.'
                      },
                      {
                        id: 'CLOSED',
                        label: 'CLOSED',
                        color: 'bg-red-500',
                        desc: 'Worker paused. No documents will undergo OCR analysis.'
                      },
                      {
                        id: 'MAINTENANCE',
                        label: 'MAINTENANCE',
                        color: 'bg-amber-500',
                        desc: 'Database migration. APIs operational in read-only mode.'
                      }
                    ].map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        disabled={user?.role !== 'SUPER_ADMIN'}
                        onClick={() => setResOpStatus(status.id)}
                        className={`relative p-4 rounded-xl border text-left transition-all duration-200 select-none ${
                          resOpStatus === status.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                            : 'border-border bg-card hover:bg-muted/40'
                        } ${user?.role !== 'SUPER_ADMIN' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {status.label}
                          </span>
                          <span className={`w-2.5 h-2.5 rounded-full ${status.color} shadow-sm`} />
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {status.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div> */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Restaurant Name *
                    </label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
                      value={resName}
                      onChange={(e) => setResName(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Tax ID / Business Registration Number
                    </label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      placeholder="e.g. BE0123456789"
                      value={resTaxId}
                      onChange={(e) => setResTaxId(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Contact Email Address
                    </label>
                    <input
                      type="email"
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      placeholder="e.g. contact@venue.com"
                      value={resEmail}
                      onChange={(e) => setResEmail(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      placeholder="e.g. +32 2 123 4567"
                      value={resPhone}
                      onChange={(e) => setResPhone(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Physical Address
                    </label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      placeholder="e.g. 123 Operational Way, Brussels"
                      value={resAddress}
                      onChange={(e) => setResAddress(e.target.value)}
                      disabled={user?.role !== 'SUPER_ADMIN'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Base Currency
                    </label>
                    <select
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
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
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Default Timezone
                    </label>
                    <select
                      className="w-full bg-secondary/30 disabled:bg-secondary/15 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
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
                </div>

                {user?.role === 'SUPER_ADMIN' && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 rounded-xl disabled:opacity-60 cursor-pointer text-xs px-6 py-3.5 bg-primary text-primary-foreground hover:translate-y-[-1px] hover:shadow-md"
                    >
                      {submitting ? 'Saving settings...' : 'Save Settings'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* ROLES & PERMISSIONS MATRIX — accessible via shield button in Team tab (dialog) */}
      {false && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm font-sans mt-4">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-bold text-foreground">Role Permissions Matrix</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define operational parameters for each system role. Changes immediately override
              constraints on assigned users.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {successMsg && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span className="font-semibold">{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5 shadow-sm">
                <AlertCircle size={15} className="text-red-500" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Apple/Linear-style Roles grid selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  name: 'Administrator',
                  desc: 'Manage system settings, staff, and registry lists.',
                  icon: Shield
                },
                {
                  name: 'Document Management',
                  desc: 'Process scans, approve invoices, and audit suppliers.',
                  icon: Mail
                },
                {
                  name: 'Chef & Kitchen',
                  desc: 'Manage items, compile recipes, and track stock count.',
                  icon: Utensils
                },
                {
                  name: 'Management View',
                  desc: 'Audit daily Pos revenues and read treasury cash flows.',
                  icon: UserIcon
                }
              ].map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setSelectedRole(r.name as SystemRole)}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    selectedRole === r.name
                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                      : 'border-border bg-card hover:bg-muted/40 hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <r.icon
                      size={15}
                      className={
                        selectedRole === r.name
                          ? 'text-primary animate-pulse'
                          : 'text-muted-foreground'
                      }
                    />
                    <span className="text-xs font-bold text-foreground">{r.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">{r.desc}</p>
                </button>
              ))}
            </div>

            {loadingPermissions || !rolePermissions ? (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading permissions matrix data...</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        <th className="py-3 px-4 min-w-[240px]">System Module</th>
                        <th className="py-3 px-4 min-w-[180px]">View Boundaries</th>
                        <th className="py-3 px-4 text-center">Create</th>
                        <th className="py-3 px-4 text-center">Edit</th>
                        <th className="py-3 px-4 text-center">Delete</th>
                        <th className="py-3 px-4 text-center">Export</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm">
                      {[
                        {
                          id: 'restaurant_settings',
                          name: 'Restaurant Settings',
                          desc: 'Configure venue details, currency, operational status.',
                          icon: Building
                        },
                        {
                          id: 'dashboard',
                          name: 'Dashboard Analytics',
                          desc: 'Control center showing overall sales, spend, and metrics.',
                          icon: TrendingUp
                        },
                        {
                          id: 'documents',
                          name: 'Documents Management',
                          desc: 'Invoice uploading, camera OCR, and extraction reviews.',
                          icon: Mail
                        },
                        {
                          id: 'suppliers',
                          name: 'Suppliers Directory',
                          desc: 'View, edit, and create vendor accounts and links.',
                          icon: Users
                        },
                        {
                          id: 'products',
                          name: 'Products & Ingredients',
                          desc: 'Log ingredients, package sizes, and items cost history.',
                          icon: Layers
                        },
                        {
                          id: 'recipes',
                          name: 'Recipes & Menu Matrix',
                          desc: 'Calculate food costs and theoretical item profit margins.',
                          icon: Utensils
                        },
                        {
                          id: 'staff_costs',
                          name: 'Staff & Labor Costs',
                          desc: 'Monitor hourly staff schedules and labor spend percentage.',
                          icon: Clock
                        },
                        {
                          id: 'sales',
                          name: 'Sales & POS Integration',
                          desc: 'Syndicate cash registers and product sales mix values.',
                          icon: TrendingUp
                        },
                        {
                          id: 'incidents',
                          name: 'Operational Incidents',
                          desc: 'Audit override events, price spikes, and alerts.',
                          icon: AlertCircle
                        },
                        {
                          id: 'reconciliation',
                          name: 'Invoice Reconciliation',
                          desc: 'Audit item pricing differences against POs and quotes.',
                          icon: CheckSquare
                        },
                        {
                          id: 'purchases',
                          name: 'Purchases Tracker',
                          desc: 'Log purchase orders, supplier dues, and cash flow dates.',
                          icon: ShoppingBag
                        },
                        {
                          id: 'inventory',
                          name: 'Inventory & Stock Count',
                          desc: 'Wastage logs, physical audit sheets, and stock audits.',
                          icon: Package
                        },
                        {
                          id: 'treasury',
                          name: 'Treasury & Cash Flow',
                          desc: 'Reconcile bank entries and registry differences.',
                          icon: DollarSign
                        },
                        {
                          id: 'staff_management',
                          name: 'Staff Management',
                          desc: 'Control staff invite codes, status, and role configs.',
                          icon: UserCheck
                        }
                      ].map((mod) => {
                        const rPerms = rolePermissions ? (rolePermissions[selectedRole] || {}) : {};
                        const modPerm = rPerms[mod.id] || {
                          view: 'None',
                          create: false,
                          edit: false,
                          delete: false,
                          export: false
                        };
                        const isLocked = modPerm.view === 'None';

                        const handleViewChange = (val: 'None' | 'Own' | 'All') => {
                          const updatedPerms = { ...modPerm, view: val };
                          if (val === 'None') {
                            updatedPerms.create = false;
                            updatedPerms.edit = false;
                            updatedPerms.delete = false;
                            updatedPerms.export = false;
                          }
                          if (rolePermissions) {
                            setRolePermissions({
                              ...rolePermissions,
                              [selectedRole]: {
                                ...rPerms,
                                [mod.id]: updatedPerms
                              }
                            });
                          }
                        };

                        const handleToggle = (
                          actionKey: 'create' | 'edit' | 'delete' | 'export'
                        ) => {
                          if (isLocked) return;
                          if (rolePermissions) {
                            setRolePermissions({
                              ...rolePermissions,
                              [selectedRole]: {
                                ...rPerms,
                                [mod.id]: { ...modPerm, [actionKey]: !modPerm[actionKey] }
                              }
                            });
                          }
                        };

                        return (
                          <tr
                            key={mod.id}
                            className="hover:bg-muted/10 transition-colors duration-100"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-secondary/50 border border-border/40 rounded-lg text-muted-foreground mt-0.5">
                                  <mod.icon size={14} />
                                </div>
                                <div>
                                  <span className="font-bold text-foreground block text-xs">
                                    {mod.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block mt-0.5 leading-normal max-w-[280px]">
                                    {mod.desc}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="inline-flex bg-muted rounded-xl p-0.5 border border-border/60">
                                {(['None', 'Own', 'All'] as const).map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => handleViewChange(level)}
                                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                                      modPerm.view === level
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    {level}
                                  </button>
                                ))}
                              </div>
                            </td>
                            {/* Modern iOS/Linear style switches instead of default checkboxes */}
                            <td className="py-4 px-4 text-center">
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleToggle('create')}
                                className={`relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5 mx-auto ${
                                  modPerm.create ? 'bg-primary' : 'bg-muted'
                                } ${isLocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                    modPerm.create ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleToggle('edit')}
                                className={`relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5 mx-auto ${
                                  modPerm.edit ? 'bg-primary' : 'bg-muted'
                                } ${isLocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                    modPerm.edit ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleToggle('delete')}
                                className={`relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5 mx-auto ${
                                  modPerm.delete ? 'bg-primary' : 'bg-muted'
                                } ${isLocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                    modPerm.delete ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleToggle('export')}
                                className={`relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5 mx-auto ${
                                  modPerm.export ? 'bg-primary' : 'bg-muted'
                                } ${isLocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                    modPerm.export ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setSubmitting(true);
                      try {
                        const payload: RolePermissionPayload[] = [];
                        if (rolePermissions) {
                          Object.entries(rolePermissions).forEach(
                            ([rName, modules]) => {
                              Object.entries(modules as Record<string, ModulePermission>).forEach(([mId, perms]) => {
                                payload.push({
                                  role_name: rName as SystemRole,
                                  module: mId,
                                  view: perms.view,
                                  create: perms.create,
                                  edit: perms.edit,
                                  delete: perms.delete,
                                  export: perms.export
                                });
                              });
                            }
                          );
                        }
                        await updateRolePermissionsAction(payload);
                        setSuccessMsg('✅ Permissions matrix saved and updated successfully!');
                      } catch (err: any) {
                        setErrorMsg(err.message || 'Failed to update permissions.');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 rounded-xl disabled:opacity-60 cursor-pointer text-xs px-6 py-3.5 bg-primary text-primary-foreground hover:translate-y-[-1px] hover:shadow-md"
                  >
                    {submitting ? 'Saving Matrix...' : 'Save Permissions Matrix'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVITE TEAM MEMBER MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setInviteModalOpen(false)}
          />
          <div className="relative bg-card border border-border w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-scale-up z-10">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserPlus size={18} className="text-muted-foreground" />
                Invite Team Member
              </h2>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {!canManage ? (
                <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/30 rounded-xl p-4 flex gap-3 items-start text-xs text-red-800 dark:text-red-300">
                  <Shield size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
                  <div>
                    <span className="font-bold block mb-0.5">Access Denied</span>
                    You do not possess the required staff_management write permission to invite team
                    members.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInviteUser} className="space-y-5">
                  {errorMsg && (
                    <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5">
                      <AlertCircle size={15} className="text-red-500" />
                      <span className="font-medium">{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        placeholder="e.g. John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        placeholder="e.g. Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        placeholder="e.g. john@venue.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                        placeholder="e.g. +1 (555) 123-4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Assigned Role *
                      </label>
                      {canManage ? (
                        <select
                          className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                          value={role}
                          onChange={(e) => setRole(e.target.value as SystemRole)}
                        >
                          {/* Only SUPER_ADMIN can assign the Administrator role */}
                          {user?.role === 'SUPER_ADMIN' && (
                            <option value="Administrator">Administrator</option>
                          )}
                          <option value="Document Management">Document Management</option>
                          <option value="Chef & Kitchen">Chef & Kitchen</option>
                          <option value="Management View">Management View</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                          value="Management View"
                          disabled
                        />
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300">
                    <Mail size={15} className="flex-shrink-0 mt-0.5 text-blue-500" />
                    <span>
                      A secure activation invite email will be dispatched. The member must click the
                      link to initialize password settings.
                    </span>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => setInviteModalOpen(false)}
                      className="inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl cursor-pointer text-xs px-5 py-3 bg-secondary text-foreground hover:bg-muted border border-border"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 rounded-xl disabled:opacity-60 cursor-pointer text-xs px-5 py-3 bg-primary text-primary-foreground hover:translate-y-[-1px] hover:shadow-md"
                    >
                      <Send size={13} />
                      {submitting ? 'Dispatching Invite...' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══ ROLE PERMISSIONS MODAL ═════════════════════════════════════ */}
      {rolePermissionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setRolePermissionsModalOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-card border border-border w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-scale-up">
            {/* ── Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  Role Permissions Matrix
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Configure module-level access controls for each system role.
                </p>
              </div>
              <button
                onClick={() => setRolePermissionsModalOpen(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Role Selector Pills */}
            <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-border/60 bg-muted/20 flex-shrink-0">
              {[
                { name: 'Administrator', icon: Shield },
                { name: 'Document Management', icon: Mail },
                { name: 'Chef & Kitchen', icon: Utensils },
                { name: 'Management View', icon: UserIcon }
              ].map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setSelectedRole(r.name as SystemRole)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    selectedRole === r.name
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <r.icon size={12} />
                  {r.name}
                </button>
              ))}
            </div>

            {/* ── Scrollable Body */}
            <div className="flex-grow overflow-y-auto p-6">
              {successMsg && successMsg.includes('Permissions') && (
                <div className="mb-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="font-semibold">{successMsg}</span>
                </div>
              )}
              {errorMsg && errorMsg.includes('ermission') && (
                <div className="mb-4 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {loadingPermissions || !rolePermissions ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Loading permissions...</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        <th className="py-3 px-4 min-w-[220px]">Module</th>
                        <th className="py-3 px-4 min-w-[160px]">View Level</th>
                        <th className="py-3 px-4 text-center">Create</th>
                        <th className="py-3 px-4 text-center">Edit</th>
                        <th className="py-3 px-4 text-center">Delete</th>
                        <th className="py-3 px-4 text-center">Export</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm">
                      {[
                        {
                          id: 'restaurant_settings',
                          name: 'Restaurant Settings',
                          desc: 'Configure venue details, currency, and status.',
                          icon: Building
                        },
                        {
                          id: 'dashboard',
                          name: 'Dashboard Analytics',
                          desc: 'Sales, spend, and operational metrics.',
                          icon: TrendingUp
                        },
                        {
                          id: 'documents',
                          name: 'Documents Management',
                          desc: 'Invoice uploading, OCR, and extraction reviews.',
                          icon: Mail
                        },
                        {
                          id: 'suppliers',
                          name: 'Suppliers Directory',
                          desc: 'Vendor accounts and supplier links.',
                          icon: Users
                        },
                        {
                          id: 'products',
                          name: 'Products & Ingredients',
                          desc: 'Ingredients, package sizes, and cost history.',
                          icon: Layers
                        },
                        {
                          id: 'recipes',
                          name: 'Recipes & Menu Matrix',
                          desc: 'Food costs and item profit margins.',
                          icon: Utensils
                        },
                        {
                          id: 'staff_costs',
                          name: 'Staff & Labor Costs',
                          desc: 'Hourly schedules and labor spend.',
                          icon: Clock
                        },
                        {
                          id: 'sales',
                          name: 'Sales & POS Integration',
                          desc: 'Cash registers and product sales mix.',
                          icon: TrendingUp
                        },
                        {
                          id: 'incidents',
                          name: 'Operational Incidents',
                          desc: 'Override events, price spikes, and alerts.',
                          icon: AlertCircle
                        },
                        {
                          id: 'reconciliation',
                          name: 'Invoice Reconciliation',
                          desc: 'Pricing differences against POs and quotes.',
                          icon: CheckSquare
                        },
                        {
                          id: 'purchases',
                          name: 'Purchases Tracker',
                          desc: 'Purchase orders, supplier dues, and cash flows.',
                          icon: ShoppingBag
                        },
                        {
                          id: 'inventory',
                          name: 'Inventory & Stock Count',
                          desc: 'Wastage logs, physical audit sheets.',
                          icon: Package
                        },
                        {
                          id: 'treasury',
                          name: 'Treasury & Cash Flow',
                          desc: 'Bank entries and registry differences.',
                          icon: DollarSign
                        },
                        {
                          id: 'staff_management',
                          name: 'Staff Management',
                          desc: 'Invite codes, status, and role configs.',
                          icon: UserCheck
                        }
                      ].map((mod) => {
                        const rPerms = rolePermissions ? (rolePermissions[selectedRole] || {}) : {};
                        const modPerm = rPerms[mod.id] || {
                          view: 'None',
                          create: false,
                          edit: false,
                          delete: false,
                          export: false
                        };
                        const isLocked = modPerm.view === 'None';

                        const handleViewChange = (val: 'None' | 'Own' | 'All') => {
                          const updated = { ...modPerm, view: val };
                          if (val === 'None') {
                            updated.create = false;
                            updated.edit = false;
                            updated.delete = false;
                            updated.export = false;
                          }
                          if (rolePermissions) {
                            setRolePermissions({
                              ...rolePermissions,
                              [selectedRole]: { ...rPerms, [mod.id]: updated }
                            });
                          }
                        };

                        const handleToggle = (k: 'create' | 'edit' | 'delete' | 'export') => {
                          if (isLocked) return;
                          if (rolePermissions) {
                            setRolePermissions({
                              ...rolePermissions,
                              [selectedRole]: {
                                ...rPerms,
                                [mod.id]: { ...modPerm, [k]: !modPerm[k] }
                              }
                            });
                          }
                        };

                        const Sw = ({
                          on,
                          locked,
                          k
                        }: {
                          on: boolean;
                          locked: boolean;
                          k: 'create' | 'edit' | 'delete' | 'export';
                        }) => (
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => handleToggle(k)}
                            className={`relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5 mx-auto ${
                              on ? 'bg-primary' : 'bg-muted'
                            } ${locked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div
                              className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`}
                            />
                          </button>
                        );

                        return (
                          <tr
                            key={mod.id}
                            className="hover:bg-muted/10 transition-colors duration-100"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-secondary/50 border border-border/40 rounded-lg text-muted-foreground">
                                  <mod.icon size={13} />
                                </div>
                                <div>
                                  <span className="font-bold text-foreground block text-xs">
                                    {mod.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block mt-0.5 leading-normal max-w-[260px]">
                                    {mod.desc}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="inline-flex bg-muted rounded-xl p-0.5 border border-border/60">
                                {(['None', 'Own', 'All'] as const).map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => handleViewChange(level)}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                                      modPerm.view === level
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    {level}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Sw on={modPerm.create} locked={isLocked} k="create" />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Sw on={modPerm.edit} locked={isLocked} k="edit" />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Sw on={modPerm.delete} locked={isLocked} k="delete" />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Sw on={modPerm.export} locked={isLocked} k="export" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => setRolePermissionsModalOpen(false)}
                className="inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl cursor-pointer text-xs px-5 py-2.5 bg-secondary text-foreground hover:bg-muted border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || loadingPermissions || !rolePermissions}
                onClick={async () => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setSubmitting(true);
                  try {
                    const payload: RolePermissionPayload[] = [];
                    if (rolePermissions) {
                      Object.entries(rolePermissions).forEach(([rName, modules]) => {
                        Object.entries(modules as Record<string, ModulePermission>).forEach(([mId, perms]) => {
                          payload.push({
                            role_name: rName as SystemRole,
                            module: mId,
                            view: perms.view,
                            create: perms.create,
                            edit: perms.edit,
                            delete: perms.delete,
                            export: perms.export
                          });
                        });
                      });
                    }
                    await updateRolePermissionsAction(payload);
                    setSuccessMsg('✅ Permissions saved successfully!');
                    setRolePermissionsModalOpen(false);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Failed to update permissions.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 rounded-xl disabled:opacity-60 cursor-pointer text-xs px-6 py-2.5 bg-primary text-primary-foreground hover:translate-y-[-1px] hover:shadow-md"
              >
                <Shield size={13} />
                {submitting ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
