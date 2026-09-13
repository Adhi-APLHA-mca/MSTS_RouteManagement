import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  apiRoutes,
  apiBuyers,
  apiEmail,
  apiModels,
  apiManageRoutes,
  apiEvents,
  type CreateRoutePayload,
  type ManagedUser,
  type ScheduledEvent,
  type ScheduledEventPayload,
  type EventRegistration,
  type EventRegistrationPayload,
} from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteVersion {
  id: string;
  label: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface Route {
  id: string;
  name: string;
  code: string;
  defaultFare?: number | null;
  whatsappGroupLink?: string | null;
  driveFolderLink?: string | null;
  versions: RouteVersion[];
  createdAt?: string;
}

export interface Buyer {
  id: string;
  routeId: string;
  routeVersionId: string;
  name: string;
  email?: string | null;
  phone: string;
  address: string;
  fareAmount: number;
  status: 'active' | 'inactive';
  joinDate: string;
  notes: string;
  emailSent?: boolean;
  emailSentAt?: string | null;
  createdAt?: string;
}

export interface AdvancePayment {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface ModelTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

export interface RouteModel {
  id: string;
  routeId: string;
  name: string;
  productionName: string;
  totalAmount: number;
  ownerName: string;
  advancePayments: AdvancePayment[];
  tasks: ModelTask[];
  status: 'in_progress' | 'delivered';
  createdAt: string;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface MstsContextValue {
  routes: Route[];
  buyers: Buyer[];                  // buyers for the currently-loaded route
  loading: boolean;
  buyersLoading: boolean;
  error: string | null;

  // Route actions
  refreshRoutes: () => Promise<void>;
  addRoute: (data: CreateRoutePayload) => Promise<Route>;
  updateRoute: (id: string, data: Partial<Route>) => Promise<void>;
  addRouteVersion: (routeId: string, label: string, description: string) => Promise<RouteVersion>;

  // Buyer actions (scoped to a routeId)
  loadBuyers: (routeId: string) => Promise<void>;
  addBuyer: (routeId: string, data: Partial<Buyer>) => Promise<Buyer>;
  addBuyers: (routeId: string, data: Partial<Buyer>[]) => Promise<Buyer[]>;
  updateBuyerStatus: (id: string, status: 'active' | 'inactive') => Promise<void>;
  deleteBuyer: (id: string) => Promise<void>;

  // Email agent
  previewEmail: (routeId: string, buyerId: string) => Promise<{ subject: string; html: string }>;
  sendEmails: (routeId: string, buyerIds: string[], subject?: string, body?: string) => Promise<{ buyerId: string; status: string; error?: string }[]>;
  draftMail: (routeId: string, buyerIds: string[], subject: string, body: string) => Promise<{ buyerId: string; status: string; error?: string }[]>;

  // Model actions (scoped to a routeId)
  models: RouteModel[];
  modelsLoading: boolean;
  loadModels: () => Promise<void>;
  addModel: (routeId: string, data: Record<string, any>) => Promise<RouteModel>;
  deleteModel: (modelId: string) => Promise<void>;
  addModelTask: (modelId: string, title: string) => Promise<ModelTask>;
  toggleModelTask: (modelId: string, taskId: string, done: boolean) => Promise<void>;
  addModelAdvance: (modelId: string, amount: number, note?: string) => Promise<AdvancePayment>;
  managedUsers: ManagedUser[];
  manageRoutesLoading: boolean;
  loadManageRoutes: () => Promise<void>;
  updateManagedUserStatus: (userId: string, data: { account?: string; device?: string }) => Promise<void>;
  updateManagedUserRoutes: (userId: string, routeIds: string[]) => Promise<void>;

  // Scheduled event actions
  events: ScheduledEvent[];
  eventsLoading: boolean;
  eventRegistrations: Record<string, EventRegistration[]>;
  loadEvents: (publicView?: boolean) => Promise<void>;
  createEvent: (data: ScheduledEventPayload) => Promise<ScheduledEvent>;
  updateEvent: (id: string, data: ScheduledEventPayload) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  loadEventRegistrations: (eventId: string) => Promise<void>;
  registerForEvent: (eventId: string, data: EventRegistrationPayload) => Promise<EventRegistration>;
  removeEventRegistration: (eventId: string, registrationId: string) => Promise<void>;
}

const MstsContext = createContext<MstsContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function MstsProvider({ children }: { children: ReactNode }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [models, setModels] = useState<RouteModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [manageRoutesLoading, setManageRoutesLoading] = useState(false);
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventRegistrations, setEventRegistrations] = useState<Record<string, EventRegistration[]>>({});

  const refreshRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRoutes.list();
      setRoutes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshRoutes(); }, [refreshRoutes]);

  // ── Route mutations ──────────────────────────────────────────────────────────

  const addRoute = useCallback(async (data: CreateRoutePayload): Promise<Route> => {
    const created = await apiRoutes.create(data);
    setRoutes(prev => [created, ...prev]);
    return created;
  }, []);

  const updateRoute = useCallback(async (id: string, data: Partial<Route>) => {
    const updated = await apiRoutes.update(id, data);
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
  }, []);

  const addRouteVersion = useCallback(async (
    routeId: string,
    label: string,
    description: string,
  ): Promise<RouteVersion> => {
    const version = await apiRoutes.addVersion(routeId, { label, description });
    setRoutes(prev => prev.map(r =>
      r.id === routeId ? { ...r, versions: [...r.versions, version] } : r,
    ));
    return version;
  }, []);

  // ── Buyer mutations ──────────────────────────────────────────────────────────

  const loadBuyers = useCallback(async (routeId: string) => {
    try {
      setBuyersLoading(true);
      const data = await apiRoutes.getBuyers(routeId);
      setBuyers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuyersLoading(false);
    }
  }, []);

  const addBuyer = useCallback(async (routeId: string, data: Partial<Buyer>): Promise<Buyer> => {
    const created = await apiRoutes.addBuyer(routeId, data);
    setBuyers(prev => [created, ...prev]);
    return created;
  }, []);

  const addBuyers = useCallback(async (routeId: string, data: Partial<Buyer>[]): Promise<Buyer[]> => {
    const created = await apiRoutes.addBuyersBatch(routeId, data);
    setBuyers(prev => [...created, ...prev]);
    return created;
  }, []);

  const updateBuyerStatus = useCallback(async (id: string, status: 'active' | 'inactive') => {
    await apiBuyers.update(id, { status });
    setBuyers(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }, []);

  const deleteBuyer = useCallback(async (id: string) => {
    await apiBuyers.delete(id);
    setBuyers(prev => prev.filter(b => b.id !== id));
  }, []);

  // ── Email agent ──────────────────────────────────────────────────────────────

  const previewEmail = useCallback(
    (routeId: string, buyerId: string) => apiEmail.preview(routeId, buyerId),
    [],
  );

  const sendEmails = useCallback(async (routeId: string, buyerIds: string[], subject?: string, body?: string) => {
    const { results } = await apiEmail.send(routeId, buyerIds, subject, body);
    results
      .filter(r => r.status === 'sent')
      .forEach(r => {
        setBuyers(prev =>
          prev.map(b =>
            b.id === r.buyerId
              ? { ...b, emailSent: true, emailSentAt: new Date().toISOString() }
              : b,
          ),
        );
      });
    return results;
  }, []);

  const draftMail = useCallback(async (
    routeId: string,
    buyerIds: string[],
    subject: string,
    body: string,
  ) => {
    const { results } = await apiEmail.sendDraft(routeId, buyerIds, subject, body);
    return results;
  }, []);

  // ── Model mutations ──────────────────────────────────────────────────────────

  const loadModels = useCallback(async (_routeId?: string) => {
    try {
      setModelsLoading(true);
      const data = await apiModels.listAll();
      setModels(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const addModel = useCallback(async (routeId: string, data: Record<string, any>): Promise<RouteModel> => {
    const created = await apiModels.create(routeId, data);
    setModels(prev => [created, ...prev]);
    return created;
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    await apiModels.delete(modelId);
    setModels(prev => prev.filter(m => m.id !== modelId));
  }, []);

  const addModelTask = useCallback(async (modelId: string, title: string): Promise<ModelTask> => {
    const task = await apiModels.addTask(modelId, title);
    // Re-fetch to get updated status
    setModels(prev => prev.map(m => m.id === modelId
      ? { ...m, tasks: [...m.tasks, task] }
      : m,
    ));
    return task;
  }, []);

  const toggleModelTask = useCallback(async (modelId: string, taskId: string, done: boolean) => {
    const result = await apiModels.toggleTask(modelId, taskId, done);
    setModels(prev => prev.map(m => {
      if (m.id !== modelId) return m;
      const tasks = m.tasks.map(t => t.id === taskId ? { ...t, done } : t);
      return { ...m, tasks, status: result.status };
    }));
  }, []);

  const addModelAdvance = useCallback(async (modelId: string, amount: number, note?: string): Promise<AdvancePayment> => {
    const payment = await apiModels.addAdvance(modelId, amount, note);
    setModels(prev => prev.map(m => m.id === modelId
      ? { ...m, advancePayments: [...(m.advancePayments || []), payment] }
      : m,
    ));
    return payment;
  }, []);

  const loadManageRoutes = useCallback(async () => {
    try {
      setManageRoutesLoading(true);
      const data = await apiManageRoutes.list();
      setManagedUsers(data.users);
      setRoutes(prev => prev.length ? prev : data.routes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setManageRoutesLoading(false);
    }
  }, []);

  const updateManagedUserStatus = useCallback(async (userId: string, data: { account?: string; device?: string }) => {
    await apiManageRoutes.updateStatus(userId, data);
    setManagedUsers(prev => prev.map(user => user.id === userId ? {
      ...user,
      accountStatus: data.account || user.accountStatus,
      deviceStatus: data.device || user.deviceStatus,
    } : user));
  }, []);

  const updateManagedUserRoutes = useCallback(async (userId: string, routeIds: string[]) => {
    await apiManageRoutes.updateRoutes(userId, routeIds);
    setManagedUsers(prev => prev.map(user => user.id === userId ? { ...user, routeIds } : user));
  }, []);

  // ── Scheduled event mutations ───────────────────────────────────────────────

  const loadEvents = useCallback(async (publicView = false) => {
    try {
      setEventsLoading(true);
      const data = await apiEvents.list(publicView);
      setEvents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const createEvent = useCallback(async (data: ScheduledEventPayload): Promise<ScheduledEvent> => {
    const created = await apiEvents.create(data);
    setEvents(prev => [created, ...prev]);
    return created;
  }, []);

  const updateEvent = useCallback(async (id: string, data: ScheduledEventPayload) => {
    const updated = await apiEvents.update(id, data);
    setEvents(prev => prev.map(event => event.id === id ? updated : event));
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    await apiEvents.delete(id);
    setEvents(prev => prev.filter(event => event.id !== id));
    setEventRegistrations(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const loadEventRegistrations = useCallback(async (eventId: string) => {
    const data = await apiEvents.listRegistrations(eventId);
    setEventRegistrations(prev => ({ ...prev, [eventId]: data }));
  }, []);

  const registerForEvent = useCallback(async (
    eventId: string,
    data: EventRegistrationPayload,
  ): Promise<EventRegistration> => {
    const created = await apiEvents.register(eventId, data);
    setEventRegistrations(prev => ({
      ...prev,
      [eventId]: [created, ...(prev[eventId] || [])],
    }));
    setEvents(prev => prev.map(event =>
      event.id === eventId ? { ...event, registeredCount: event.registeredCount + 1 } : event,
    ));
    return created;
  }, []);

  const removeEventRegistration = useCallback(async (eventId: string, registrationId: string) => {
    await apiEvents.removeRegistration(eventId, registrationId);
    setEventRegistrations(prev => ({
      ...prev,
      [eventId]: (prev[eventId] || []).filter(registration => registration.id !== registrationId),
    }));
    setEvents(prev => prev.map(event =>
      event.id === eventId ? { ...event, registeredCount: Math.max(0, event.registeredCount - 1) } : event,
    ));
  }, []);

  return (
    <MstsContext.Provider
      value={{
        routes,
        buyers,
        loading,
        buyersLoading,
        error,
        refreshRoutes,
        addRoute,
        updateRoute,
        addRouteVersion,
        loadBuyers,
        addBuyer,
        addBuyers,
        updateBuyerStatus,
        deleteBuyer,
        previewEmail,
        sendEmails,
        draftMail,
        models,
        modelsLoading,
        loadModels,
        addModel,
        deleteModel,
        addModelTask,
        toggleModelTask,
        addModelAdvance,
        managedUsers,
        manageRoutesLoading,
        loadManageRoutes,
        updateManagedUserStatus,
        updateManagedUserRoutes,
        events,
        eventsLoading,
        eventRegistrations,
        loadEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        loadEventRegistrations,
        registerForEvent,
        removeEventRegistration,
      }}
    >
      {children}
    </MstsContext.Provider>
  );
}

export function useMsts() {
  const ctx = useContext(MstsContext);
  if (!ctx) throw new Error('useMsts must be used within MstsProvider');
  return ctx;
}
