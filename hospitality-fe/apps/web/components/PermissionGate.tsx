'use client';

import React from 'react';
import { useAuthStore } from '../store/auth';

interface PermissionGateProps {
  module?: string;
  action?: string;
  permission?: string; // Legacy permission support
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ module, action, permission, children, fallback = null }: PermissionGateProps) {
  const { user } = useAuthStore();

  if (!user) {
    return <>{fallback}</>;
  }

  const role = user.role?.toUpperCase() || '';

  // SUPER_ADMIN has full access to everything
  if (role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  const perms = user.permissions || {};

  // 1. Check module-specific permission
  if (module && action) {
    const modPerm = (perms[module] || {}) as any;
    if (action === 'view') {
      if (modPerm.view && modPerm.view !== 'None') {
        return <>{children}</>;
      }
    } else {
      if (modPerm[action] === true) {
        return <>{children}</>;
      }
    }
    return <>{fallback}</>;
  }

  // 2. Fallback to legacy permission string mapping
  if (permission) {
    if (permission === 'configure_restaurant') {
      const settingsPerm = perms['restaurant_settings'] || {};
      if (settingsPerm.view && settingsPerm.view !== 'None') {
        return <>{children}</>;
      }
    } else if (permission === 'manage') {
      const staffPerm = perms['staff_management'] || {};
      if (staffPerm.view && staffPerm.view !== 'None') {
        return <>{children}</>;
      }
    } else if (permission === 'read') {
      const hasAnyView = Object.values(perms).some((p: any) => p.view && p.view !== 'None');
      if (hasAnyView) {
        return <>{children}</>;
      }
    } else if (permission === 'write') {
      const hasAnyWrite = Object.values(perms).some((p: any) => p.create === true || p.edit === true || p.delete === true);
      if (hasAnyWrite) {
        return <>{children}</>;
      }
    }
  }

  return <>{fallback}</>;
}
