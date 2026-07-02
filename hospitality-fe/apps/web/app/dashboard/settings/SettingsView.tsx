'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/auth';
import { Badge, Toggle } from '../_components/ui';
import {
  Users,
  Settings as SettingsIcon,
  UserPlus,
  Shield,
  Plus,
  Building2,
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
  ChevronDown,
  ChevronUp,
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
  updateRolePermissionsAction,
  getAllRestaurantsAction,
  createRestaurantAction,
  switchRestaurantAction
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
  const [activeTab, setActiveTab] = useState<'profile' | 'restaurant'>('profile');

  // Roles & Permissions States
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap | null>(null);
  const [selectedRole, setSelectedRole] = useState<SystemRole>('Administrator');
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [rolePermissionsModalOpen, setRolePermissionsModalOpen] = useState(false);

  useEffect(() => {
    if (rolePermissionsModalOpen) {
      fetchRolePermissions();
    }
  }, [rolePermissionsModalOpen]);

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
  const [expandedTeams, setExpandedTeams] = useState<Record<number, boolean>>({});

  // Add Restaurant Modal States
  const [showAddResModal, setShowAddResModal] = useState(false);
  const [addResName, setAddResName] = useState('');
  const [addResAddress, setAddResAddress] = useState('');
  const [addResPhone, setAddResPhone] = useState('');
  const [addResCurrency, setAddResCurrency] = useState('EUR');
  const [addResSubmitting, setAddResSubmitting] = useState(false);
  const [addResError, setAddResError] = useState<string | null>(null);

  // Multi-restaurant States
  const [invitingToRestaurantId, setInvitingToRestaurantId] = useState<number | null>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [restaurantUsers, setRestaurantUsers] = useState<Record<number, User[]>>({});
  const [loadingRestaurantUsers, setLoadingRestaurantUsers] = useState<Record<number, boolean>>({});

  const toggleTeamExpand = (restaurantId: number) => {
    setExpandedTeams(prev => ({
      ...prev,
      [restaurantId]: !prev[restaurantId]
    }));
  };

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

  const handleAddRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addResName.trim()) {
      setAddResError('Restaurant name is required.');
      return;
    }
    setAddResError(null);
    setAddResSubmitting(true);
    try {
      const created = await createRestaurantAction({
        name: addResName.trim(),
        address: addResAddress.trim() || undefined,
        phone: addResPhone.trim() || undefined,
        currency: addResCurrency
      });
      
      // Auto switch user to newly registered restaurant
      await switchRestaurantAction(created.id);
      
      // Reload page to reflect new context
      window.location.reload();
    } catch (err: any) {
      setAddResError(err.message || 'Failed to create restaurant.');
    } finally {
      setAddResSubmitting(false);
    }
  };

  const fetchUsersForRestaurant = async (resId: number) => {
    setLoadingRestaurantUsers(prev => ({ ...prev, [resId]: true }));
    try {
      const data = await getUsersAction({
        restaurant_id: resId,
        limit: 100
      });
      setRestaurantUsers(prev => ({ ...prev, [resId]: data.items || [] }));
    } catch (err) {
      console.error(`Failed to load users for restaurant ${resId}:`, err);
    } finally {
      setLoadingRestaurantUsers(prev => ({ ...prev, [resId]: false }));
    }
  };

  const fetchRestaurantsList = async () => {
    setLoadingRestaurants(true);
    try {
      const data = await getAllRestaurantsAction();
      setRestaurants(data);
      // Load team members for each restaurant
      data.forEach((r: any) => {
        fetchUsersForRestaurant(r.id);
      });
    } catch (err) {
      console.error('Failed to fetch restaurants list:', err);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const refreshUsersList = (restaurantId?: number) => {
    if (user?.role === 'SUPER_ADMIN' && restaurantId) {
      fetchUsersForRestaurant(restaurantId);
    } else {
      fetchUsers();
    }
  };

  useEffect(() => {
    if (activeTab === 'restaurant') {
      if (user?.role === 'SUPER_ADMIN') {
        fetchRestaurantsList();
      } else {
        fetchRestaurant();
        fetchUsers();
      }
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
      const targetRestaurantId = invitingToRestaurantId || user?.restaurant_id;
      await createUserAction({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        role,
        restaurant_id: targetRestaurantId || undefined
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
      if (targetRestaurantId) {
        if (user?.role === 'SUPER_ADMIN' && restaurantUsers[targetRestaurantId]) {
          fetchUsersForRestaurant(targetRestaurantId);
        } else {
          fetchUsers();
        }
      }
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Failed to send invite. Make sure the email is not already registered.'
      );
    } finally {
      setSubmitting(false);
      setInvitingToRestaurantId(null);
    }
  };

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'Administrator';


  const handleResendInvite = async (userId: number, restaurantId?: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await resendInviteAction(userId);
      setSuccessMsg('✅ Invitation link resent successfully!');
      refreshUsersList(restaurantId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend invitation.');
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: string, restaurantId?: number) => {
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
      refreshUsersList(restaurantId);
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
            Configure restaurant profiles, customize permission boundaries, and audit team access.
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
            <Building size={14} />
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
      {/* ══ RESTAURANT SETTINGS TAB ═══════════════════════════════════ */}
      {activeTab === 'restaurant' && (
        <div className="space-y-6 max-w-4xl">
          {/* Header Card */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                <Building size={20} className="text-primary" />
                Restaurant Settings
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.role === 'SUPER_ADMIN'
                  ? 'Manage your restaurants, invite staff members under each restaurant, and configure operational variables.'
                  : 'View active operational settings and contact metadata.'}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'Administrator') && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setRolePermissionsModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-secondary border border-border text-foreground hover:bg-muted rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Shield size={13} />
                  Role Permissions
                </button>
              )}
              {user?.role === 'SUPER_ADMIN' && (
                <button
                  type="button"
                  onClick={() => setShowAddResModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus size={13} />
                  Add Restaurant
                </button>
              )}
            </div>
          </div>

          {user?.role === 'SUPER_ADMIN' ? (
            /* Multi-restaurant View for SUPER_ADMIN */
            loadingRestaurants ? (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Loading restaurants list...</span>
              </div>
            ) : restaurants.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground space-y-3">
                <Building2 size={36} className="mx-auto text-muted-foreground/45" />
                <p className="text-sm font-semibold">No restaurants found</p>
                <p className="text-xs text-muted-foreground">Register your first restaurant to start managing staff and documents.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {restaurants.map((r) => {
                  const isActive = r.id === user?.restaurant_id;
                  const members = (restaurantUsers[r.id] || []).filter(m => m.role !== 'SUPER_ADMIN');
                  const loadingMembers = loadingRestaurantUsers[r.id];
                  const isExpanded = expandedTeams[r.id];

                  return (
                    <div key={r.id} className={`bg-card rounded-2xl border transition-all ${isActive ? 'border-primary/45 shadow-sm shadow-primary/5' : 'border-border'} p-6 space-y-6`}>
                      {/* Restaurant Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-secondary rounded-xl text-foreground">
                            <Building size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-foreground">{r.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{r.address || 'No address configured'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleTeamExpand(r.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-secondary text-foreground hover:bg-muted rounded-xl border border-border transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {isExpanded ? 'Hide Staff' : 'Show Staff'} ({members.length})
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Team Members List */}
                      {isExpanded && (
                        <div className="pt-2 space-y-4 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                              Staff Members List
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setInvitingToRestaurantId(r.id);
                                setInviteModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-primary text-primary-foreground hover:opacity-95 rounded-lg shadow-sm cursor-pointer transition-all active:scale-95"
                            >
                              <UserPlus size={11} />
                              Invite Staff
                            </button>
                          </div>

                          {loadingMembers ? (
                            <div className="py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px]">Loading staff...</span>
                            </div>
                          ) : members.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">No staff members in this restaurant yet.</p>
                          ) : (
                            <div className="overflow-x-auto border border-border rounded-xl">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-muted/50 border-b border-border text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                    <th className="py-2.5 px-3">Member</th>
                                    <th className="py-2.5 px-3">System Role</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 text-xs">
                                  {members.map((member) => {
                                    const isSelf = member.id === user?.id;
                                    const s = statusConfig(member.status);
                                    return (
                                      <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="py-3 px-3">
                                          <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground border border-border/40">
                                              {member.first_name?.[0]}{member.last_name?.[0]}
                                            </div>
                                            <div>
                                              <span className="font-bold text-foreground block">
                                                {member.first_name} {member.last_name} {isSelf && '(You)'}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground block">{member.email}</span>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground border border-border/60">
                                            {member.role}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                            <span className={`font-semibold ${s.color}`}>{s.label}</span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                                          {!isSelf && (
                                            <>
                                              {(member.status === 'INVITED' || member.status === 'INACTIVE') && (
                                                <button
                                                  onClick={() => handleResendInvite(member.id, r.id)}
                                                  className="inline-flex items-center justify-center text-[9px] font-bold tracking-wider uppercase px-2 py-1 bg-secondary text-foreground hover:bg-muted border border-border rounded-md transition-all cursor-pointer"
                                                >
                                                  Resend
                                                </button>
                                              )}
                                              {(member.status === 'ACTIVE' || member.status === 'INVITED') && (
                                                <button
                                                  onClick={() => handleToggleStatus(member.id, member.status, r.id)}
                                                  className="inline-flex items-center justify-center text-[9px] font-bold tracking-wider uppercase px-2 py-1 bg-red-500/10 text-red-600 dark:bg-red-500/5 dark:text-red-400 hover:bg-red-500/20 rounded-md border border-red-500/20 transition-all cursor-pointer"
                                                >
                                                  Deactivate
                                                </button>
                                              )}
                                              {member.status === 'INACTIVE' && (
                                                <button
                                                  onClick={() => handleToggleStatus(member.id, member.status, r.id)}
                                                  className="inline-flex items-center justify-center text-[9px] font-bold tracking-wider uppercase px-2 py-1 bg-[#1f8f5c]/10 text-[#1f8f5c] hover:bg-[#1f8f5c]/20 rounded-md border border-[#1f8f5c]/20 transition-all cursor-pointer"
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Single Restaurant View for Owners/Staff */
            <div className="space-y-6">
              {/* Restaurant profile card */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Building size={16} className="text-muted-foreground" />
                      Restaurant Profile
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Operational metadata and timezone parameters. Contact your administrator to edit.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border mt-2 sm:mt-0">
                    <Lock size={10} />
                    Read Only
                  </span>
                </div>

                {loadingRestaurant ? (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading profile...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Restaurant Name
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resName}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Tax ID / Business Registration Number
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resTaxId || 'Not configured'}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Contact Email Address
                      </label>
                      <input
                        type="email"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resEmail || 'Not configured'}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Contact Phone Number
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resPhone || 'Not configured'}
                        disabled
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Physical Address
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resAddress || 'Not configured'}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Base Currency
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resCurrency}
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Default Timezone
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/10 border border-border rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                        value={resTimezone}
                        disabled
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Team Members Card for single restaurant view */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Users size={16} className="text-muted-foreground" />
                      Team Registry ({users.filter(u => u.role !== 'SUPER_ADMIN').length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Audit profile parameters and system logins for staff at this restaurant.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTeamExpand(user?.restaurant_id || 0)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-secondary text-foreground hover:bg-muted rounded-xl border border-border transition-colors cursor-pointer"
                  >
                    {expandedTeams[user?.restaurant_id || 0] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {expandedTeams[user?.restaurant_id || 0] ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                {expandedTeams[user?.restaurant_id || 0] && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="relative flex-1 max-w-md">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          className="w-full bg-secondary/30 border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                          placeholder="Search members by name or email..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvitingToRestaurantId(null);
                            setInviteModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary text-primary-foreground hover:opacity-95 rounded-xl shadow-sm cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <UserPlus size={13} />
                          Invite Member
                        </button>
                      )}
                    </div>

                    {loadingUsers ? (
                      <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Querying members...</span>
                      </div>
                    ) : users.filter(u => u.role !== 'SUPER_ADMIN').length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">No team members match your criteria.</p>
                    ) : (
                      <>
                        <div className="overflow-x-auto border border-border rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                <th className="py-2.5 px-3">Member</th>
                                <th className="py-2.5 px-3">System Role</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-xs">
                              {users.filter(u => u.role !== 'SUPER_ADMIN').map((member) => {
                                const isSelf = member.id === user?.id;
                                const s = statusConfig(member.status);
                                return (
                                  <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground border border-border/40">
                                          {member.first_name?.[0]}{member.last_name?.[0]}
                                        </div>
                                        <div>
                                          <span className="font-bold text-foreground block">
                                            {member.first_name} {member.last_name} {isSelf && '(You)'}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground block">{member.email}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-foreground border border-border/60">
                                        {member.role}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                        <span className={`font-semibold ${s.color}`}>{s.label}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                                      {!isSelf && canManage && (
                                        <>
                                          {(member.status === 'INVITED' || member.status === 'INACTIVE') && (
                                            <button
                                              onClick={() => handleResendInvite(member.id)}
                                              className="inline-flex items-center justify-center text-[9px] font-bold tracking-wider uppercase px-2 py-1 bg-secondary text-foreground hover:bg-muted border border-border rounded-md transition-all cursor-pointer"
                                            >
                                              Resend
                                            </button>
                                          )}
                                          {(member.status === 'ACTIVE' || member.status === 'INVITED') && (
                                            <button
                                              onClick={() => handleToggleStatus(member.id, member.status)}
                                              className="inline-flex items-center justify-center text-[9px] font-bold tracking-wider uppercase px-2 py-1 bg-red-500/10 text-red-600 dark:bg-red-500/5 dark:text-red-400 hover:bg-red-500/20 rounded-md border border-red-500/20 transition-all cursor-pointer"
                                            >
                                              Deactivate
                                            </button>
                                          )}
                                          {member.status === 'INACTIVE' && (
                                            <button
                                              onClick={() => handleToggleStatus(member.id, member.status)}
                                              className="inline-flex items-center justify-center text-[9px] font-bold tracking-wider uppercase px-2 py-1 bg-[#1f8f5c]/10 text-[#1f8f5c] hover:bg-[#1f8f5c]/20 rounded-md border border-[#1f8f5c]/20 transition-all cursor-pointer"
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

                        {/* Table Pagination */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between border-t border-border pt-4">
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Page {page} of {totalPages} ({users.filter(u => u.role !== 'SUPER_ADMIN').length} staff total)
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                disabled={page === 1}
                                className="inline-flex items-center justify-center p-1.5 bg-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-border transition-colors cursor-pointer"
                              >
                                <ChevronLeft size={13} />
                              </button>
                              <button
                                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                disabled={page === totalPages}
                                className="inline-flex items-center justify-center p-1.5 bg-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-border transition-colors cursor-pointer"
                              >
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ROLE PERMISSIONS MODAL ═════════════════════════════════════ */}
      {rolePermissionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setRolePermissionsModalOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-card border border-border w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                  <Shield size={16} className="text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground leading-none">Role Permissions Matrix</h2>
                  <p className="text-[10px] text-muted-foreground mt-1">Configure module-level access controls for each system role.</p>
                </div>
              </div>
              <button
                onClick={() => setRolePermissionsModalOpen(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Role Selector Pills */}
            <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-border/60 bg-muted/20 flex-shrink-0 font-sans">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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

            {/* Scrollable Body */}
            <div className="flex-grow overflow-y-auto p-6 font-sans">
              {successMsg && successMsg.includes('Permissions') && (
                <div className="mb-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm animate-fade-in">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="font-semibold">{successMsg}</span>
                </div>
              )}
              {errorMsg && errorMsg.includes('ermission') && (
                <div className="mb-4 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5 shadow-sm animate-fade-in">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {loadingPermissions || !rolePermissions ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Loading permissions...</span>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        <th className="py-3.5 px-4 min-w-[220px]">Module</th>
                        <th className="py-3.5 px-4 min-w-[160px]">View Level</th>
                        <th className="py-3.5 px-4 text-center">Create</th>
                        <th className="py-3.5 px-4 text-center">Edit</th>
                        <th className="py-3.5 px-4 text-center">Delete</th>
                        <th className="py-3.5 px-4 text-center">Export</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-sm">
                      {[
                        {
                          id: 'restaurant_settings',
                          name: 'Restaurant Settings',
                          desc: 'Configure restaurant details, currency, and status.',
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
                            <td className="py-3 px-4">
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
                            <td className="py-3 px-4">
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

            {/* Save Button Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/10 flex-shrink-0">
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

      {/* ══ INVITE TEAM MEMBER MODAL ═══════════════════════════════════ */}
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
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
                      placeholder="john.doe@restaurant.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                      placeholder="+32 470 12 34 56"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                      System Access Role
                    </label>
                    <select
                      className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold cursor-pointer"
                      value={role}
                      onChange={(e) => setRole(e.target.value as SystemRole)}
                    >
                      <option value="Management View">Management View</option>
                      <option value="Chef & Kitchen">Chef & Kitchen</option>
                      <option value="Document Management">Document Management</option>
                      <option value="Administrator">Administrator</option>
                    </select>
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

      {/* ══ ADD RESTAURANT MODAL ════════════════════════════════════════ */}
      {showAddResModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => { setShowAddResModal(false); setAddResError(null); }}
          />

          {/* Dialog */}
          <div className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col animate-scale-up font-sans">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                  <Building2 size={16} className="text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground leading-none">New Restaurant</h2>
                  <p className="text-[10px] text-muted-foreground mt-1">Register a new restaurant branch under your account.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddResModal(false); setAddResError(null); }}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddRestaurant} className="flex-grow overflow-y-auto p-6 space-y-4">
              {addResError && (
                <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2.5">
                  <AlertCircle size={15} className="text-red-500" />
                  <span className="font-medium">{addResError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
                  placeholder="e.g. La Place Brussels"
                  value={addResName}
                  onChange={(e) => setAddResName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Address
                </label>
                <input
                  type="text"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  placeholder="e.g. Rue Neuve 12, 1000 Brussels"
                  value={addResAddress}
                  onChange={(e) => setAddResAddress(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  placeholder="e.g. +32 2 123 4567"
                  value={addResPhone}
                  onChange={(e) => setAddResPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
                  Base Currency
                </label>
                <select
                  className="w-full bg-secondary/30 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                  value={addResCurrency}
                  onChange={(e) => setAddResCurrency(e.target.value)}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowAddResModal(false); setAddResError(null); }}
                  className="inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl cursor-pointer text-xs px-5 py-2.5 bg-secondary text-foreground hover:bg-muted border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addResSubmitting}
                  className="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 rounded-xl disabled:opacity-60 cursor-pointer text-xs px-5 py-2.5 bg-primary text-primary-foreground hover:translate-y-[-1px] hover:shadow-md"
                >
                  {addResSubmitting ? 'Registering...' : 'Register Restaurant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
