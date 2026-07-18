import type { Route, Buyer } from '@/store/msts-store';

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Routes ──────────────────────────────────────────────────────────────────

export interface CreateRoutePayload {
  name: string;
  code: string;
  whatsappGroupLink?: string;
  driveFolderLink?: string;
  versionLabel?: string;
  versionDesc?: string;
}

export const apiRoutes = {
  list: () => req<Route[]>('/routes'),

  create: (data: CreateRoutePayload) =>
    req<Route>('/routes', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Route>) =>
    req<Route>(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  addVersion: (routeId: string, payload: { label: string; description: string }) =>
    req<{ id: string; label: string; description: string; isActive: boolean; createdAt: string }>(
      `/routes/${routeId}/versions`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getBuyers: (routeId: string) => req<Buyer[]>(`/routes/${routeId}/buyers`),

  addBuyer: (routeId: string, data: Partial<Buyer>) =>
    req<Buyer>(`/routes/${routeId}/buyers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addBuyersBatch: (routeId: string, buyers: Partial<Buyer>[]) =>
    req<Buyer[]>(`/routes/${routeId}/buyers/batch`, {
      method: 'POST',
      body: JSON.stringify({ buyers }),
    }),
};

// ── Buyers ───────────────────────────────────────────────────────────────────

export const apiBuyers = {
  update: (id: string, data: Partial<Buyer>) =>
    req<Buyer>(`/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    req<{ success: boolean }>(`/buyers/${id}`, { method: 'DELETE' }),
};

// ── Email ────────────────────────────────────────────────────────────────────

export const apiEmail = {
  preview: (routeId: string, buyerId: string) =>
    req<{ subject: string; html: string }>('/email/preview', {
      method: 'POST',
      body: JSON.stringify({ routeId, buyerId }),
    }),

  send: (routeId: string, buyerIds: string[]) =>
    req<{ results: { buyerId: string; status: 'sent' | 'failed'; error?: string }[] }>(
      '/email/send',
      { method: 'POST', body: JSON.stringify({ routeId, buyerIds }) },
    ),
};
