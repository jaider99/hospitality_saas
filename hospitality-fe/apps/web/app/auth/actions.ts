'use server';

import { cookies } from 'next/headers';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  return {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
  };
}

export async function getMeAction() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch user profile');
  }

  return res.json();
}
