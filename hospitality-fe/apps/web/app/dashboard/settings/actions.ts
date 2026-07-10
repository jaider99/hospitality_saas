'use server';

import { cookies } from 'next/headers';
import type {
  UpdateRestaurantPayload,
  CreateUserPayload,
  RolePermissionPayload,
} from '@hospitality-saas/shared-types';

const API_BASE = (process.env.NEXT_PRIVATE_API_URL || 'http://127.0.0.1:8000') + '/api/v1';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  return {
    'Content-Type': 'application/json',
    Cookie: cookieStore.toString(),
  };
}

/**
 * Validates the session by calling the backend /auth/me endpoint.
 * Throws an error if the session cookie is missing or invalid.
 */
async function requireSession(): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/auth/me`, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Unauthorized: valid session required.');
  }
}

// ─── Restaurant ───────────────────────────────────────────────────────────────

export async function getRestaurantAction() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/restaurant`, { headers, cache: 'no-store' });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch restaurant details');
  }

  return res.json();
}

export async function updateRestaurantAction(data: UpdateRestaurantPayload, restaurantId?: number) {
  await requireSession();
  const headers = await getAuthHeaders();
  
  const url = restaurantId 
    ? `${API_BASE}/restaurant/${restaurantId}`
    : `${API_BASE}/restaurant`;

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update restaurant settings');
  }

  return res.json();
}

export async function getAllRestaurantsAction() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/restaurant/all`, { headers, cache: 'no-store' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch restaurants');
  }
  return res.json();
}

export async function createRestaurantAction(data: {
  name: string;
  address?: string;
  phone?: string;
  currency?: string;
}) {
  await requireSession();
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/restaurant`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create restaurant');
  }
  return res.json();
}

export async function switchRestaurantAction(restaurantId: number) {
  await requireSession();
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/restaurant/switch`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to switch restaurant');
  }
  return res.json();
}

// ─── Users / Team ─────────────────────────────────────────────────────────────

export async function getUsersAction(params?: {
  search?: string;
  restaurant_id?: number;
  page?: number;
  limit?: number;
}) {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.restaurant_id) query.append('restaurant_id', String(params.restaurant_id));
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const qs = query.toString();
  const res = await fetch(`${API_BASE}/users${qs ? `?${qs}` : ''}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch team members');
  }

  return res.json();
}

export async function createUserAction(data: CreateUserPayload) {
  await requireSession();
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to invite team member');
  }

  return res.json();
}

export async function resendInviteAction(id: number) {
  await requireSession();
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/users/${id}/resend-invite`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to resend invitation');
  }

  return res.json();
}

export async function updateUserStatusAction(id: number, status: 'ACTIVE' | 'INACTIVE') {
  await requireSession();
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/users/${id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update user status');
  }

  return res.json();
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export async function getRolePermissionsAction() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/roles/permissions`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch role permissions');
  }

  return res.json();
}

export async function updateRolePermissionsAction(payload: RolePermissionPayload[]) {
  await requireSession();
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/roles/permissions`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update role permissions');
  }

  return res.json();
}
