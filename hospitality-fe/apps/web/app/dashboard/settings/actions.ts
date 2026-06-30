'use server';

import { cookies } from 'next/headers';

const API_BASE = 'http://localhost:8000/api/v1';

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  return {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
  };
}

export async function getRestaurantAction() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/restaurant`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch restaurant details');
  }

  return res.json();
}

export async function updateRestaurantAction(data: any) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/restaurant`, {
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

export async function getUsersAction(params?: { search?: string; page?: number; limit?: number }) {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const url = `${API_BASE}/users${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch team members');
  }

  return res.json();
}

export async function createUserAction(data: any) {
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
