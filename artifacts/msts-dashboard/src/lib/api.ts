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
  defaultFare?: number;
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

// ── Models ───────────────────────────────────────────────────────────────────

export const apiModels = {
  listAll: () =>
    req<any[]>(`/models`),

  list: (routeId: string) =>
    req<any[]>(`/routes/${routeId}/models`),

  create: (_routeId: string, data: Record<string, any>) =>
    req<any>(`/models`, { method: 'POST', body: JSON.stringify(data) }),

  update: (modelId: string, data: Record<string, any>) =>
    req<any>(`/models/${modelId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (modelId: string) =>
    req<{ success: boolean }>(`/models/${modelId}`, { method: 'DELETE' }),

  addAdvance: (modelId: string, amount: number, note?: string) =>
    req<any>(`/models/${modelId}/advance`, { method: 'POST', body: JSON.stringify({ amount, note }) }),

  addTask: (modelId: string, title: string) =>
    req<any>(`/models/${modelId}/tasks`, { method: 'POST', body: JSON.stringify({ title }) }),

  toggleTask: (modelId: string, taskId: string, done: boolean) =>
    req<any>(`/models/${modelId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
};

export interface ManagedUser {
  id: string;
  username: string;
  accountStatus: string;
  deviceStatus: string;
  routeIds: string[];
}

export const apiManageRoutes = {
  list: () => req<{ users: ManagedUser[]; routes: Route[] }>('/manage-routes'),
  updateStatus: (userId: string, data: { account?: string; device?: string }) =>
    req<any>(`/manage-routes/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateRoutes: (userId: string, routeIds: string[]) =>
    req<any>(`/manage-routes/users/${userId}/routes`, { method: 'PUT', body: JSON.stringify({ routeIds }) }),
};

// ── Email ────────────────────────────────────────────────────────────────────

export const apiEmail = {
  preview: (routeId: string, buyerId: string) =>
    req<{ subject: string; html: string }>('/email/preview', {
      method: 'POST',
      body: JSON.stringify({ routeId, buyerId }),
    }),

  send: (routeId: string, buyerIds: string[], subject?: string, body?: string) =>
    req<{ results: { buyerId: string; status: 'sent' | 'failed'; error?: string }[] }>(
      '/email/send',
      { method: 'POST', body: JSON.stringify({ routeId, buyerIds, subject, body }) },
    ),

  sendDraft: (routeId: string, buyerIds: string[], subject: string, body: string) =>
    req<{ results: { buyerId: string; status: 'sent' | 'failed'; error?: string }[] }>(
      '/email/draft',
      { method: 'POST', body: JSON.stringify({ routeId, buyerIds, subject, body }) },
    ),
};
