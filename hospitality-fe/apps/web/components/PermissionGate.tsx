'use client';

import React from 'react';
import { useAuthStore } from '../store/auth';

// Centralized Role-to-Permissions Mapping matching the backend RBAC.
// This ensures frontend UI elements align with backend endpoint constraints.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['read', 'write', 'manage'],
  MANAGER: ['read', 'write', 'manage'],
};

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { user } = useAuthStore();
  const userRole = user?.role?.toUpperCase() || '';
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];

  if (userPermissions.includes(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
