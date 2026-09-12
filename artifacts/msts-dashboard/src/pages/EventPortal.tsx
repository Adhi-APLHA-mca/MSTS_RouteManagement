import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  LogIn,
  LogOut,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  TrainFront,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiEventUsers } from '@/lib/api';
import type {
  EventRegistration,
  EventTrain,
  ScheduledEvent,
} from '@/lib/api';
import { useMsts } from '@/store/msts-store';

const SESSION_USERNAME_KEY = 'msts-event-username';

type RegistrationForm = {
  name: string;
  email: string;
  phone: string;
  trainName: string;
  startPoint: string;
  endPoint: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function isEventExpired(event: ScheduledEvent, now = new Date()) {
  if (!event.expiryDate) return false;
  const closesAt = new Date(`${event.expiryDate}T23:59:59`);
  return !Number.isNaN(closesAt.getTime()) && closesAt < now;
}

function formatDateTime(value: string) {
  if (!value) return 'Time to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string) {
  if (!value) return 'Open until event day';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function routeLabel(routeId: string, routes: { id: string; name: string; code: string }[]) {
  const route = routes.find(item => item.id === routeId);
  return route ? `${route.name} · ${route.code}` : 'Route details to follow';
}

function emptyRegistration(): RegistrationForm {
  return {
    name: '',
    email: '',
    phone: '',
    trainName: '',
    startPoint: '',
    endPoint: '',
  };
}

function EventSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading events">
      {[1, 2].map(item => (
        <div key={item} className="overflow-hidden rounded-[1.35rem] border border-[#dfe6e9] bg-[#fffdf9] p-6">
          <div className="flex animate-pulse flex-col gap-5">
            <div className="h-4 w-28 rounded-full bg-[#dfe7e5]" />
            <div className="h-8 w-3/4 rounded-lg bg-[#dfe7e5]" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-[#e7ece9]" />
              <div className="h-3 w-5/6 rounded bg-[#e7ece9]" />
            </div>
            <div className="h-20 rounded-xl bg-[#edf1ee]" />
            <div className="h-10 rounded-lg bg-[#dfe7e5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ event }: { event: ScheduledEvent }) {
  const full = event.capacity <= 0 || event.registeredCount >= event.capacity;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
        full
          ? 'border-[#e8c9a5] bg-[#fff6e9] text-[#a7652e]'
          : 'border-[#b9d8cf] bg-[#edf8f3] text-[#276b57]'
      }`}
    >
      {full ? <UsersRound size={12} /> : <Radio size={12} />}
      {full ? 'At capacity' : 'Registration open'}
    </Badge>
  );
}

function TrainSummary({ train }: { train: EventTrain }) {
  return (
    <div className="rounded-xl border border-[#dfe8e4] bg-[#f6faf7] p-3.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#dbeee8] text-[#236d5a]">
          <TrainFront size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#183a3a]">{train.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#607875]">
            <span>{train.startPoint}</span>
            <ArrowRight size={12} />
            <span>{train.endPoint}</span>
          </p>
        </div>
        <a
          href={train.driveLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[#327a67] transition-colors hover:bg-[#e2f1eb] hover:text-[#1d5d4d]"
          aria-label={`Open Drive link for ${train.name}`}
        >
          Drive <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function EventCard({
  event,
  route,
  username,
  onRegister,
}: {
  event: ScheduledEvent;
  route: string;
  username: string;
  onRegister: (event: ScheduledEvent) => void;
}) {
  const full = event.capacity <= 0 || event.registeredCount >= event.capacity;
  const remaining = Math.max(0, event.capacity - event.registeredCount);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="group relative overflow-hidden rounded-[1.35rem] border border-[#dfe6e9] bg-[#fffdf9] shadow-[0_8px_30px_rgba(33,67,63,0.06)] transition-shadow duration-300 hover:shadow-[0_16px_38px_rgba(33,67,63,0.11)]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[#3c8b76]" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill event={event} />
          <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#94a6a0]">
            RUN / {event.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <h2 className="mt-5 text-[1.45rem] font-semibold leading-tight text-[#183a3a] sm:text-[1.65rem]">
          {event.name}
        </h2>
        {event.description && (
          <p className="mt-2.5 max-w-xl text-sm leading-6 text-[#607875]">{event.description}</p>
        )}

        <div className="mt-5 grid gap-3 border-y border-[#e7ece9] py-4 text-xs text-[#54716c] sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <MapPin size={15} className="mt-0.5 shrink-0 text-[#3c8b76]" />
            <div>
              <p className="font-semibold text-[#365853]">{route}</p>
              <p className="mt-0.5 text-[#78908b]">Scheduled route</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CalendarDays size={15} className="mt-0.5 shrink-0 text-[#3c8b76]" />
            <div>
              <p className="font-semibold text-[#365853]">{formatDateTime(event.startDateTime)}</p>
              <p className="mt-0.5 text-[#78908b]">Departure time</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock3 size={15} className="mt-0.5 shrink-0 text-[#3c8b76]" />
            <div>
              <p className="font-semibold text-[#365853]">{formatDate(event.expiryDate)}</p>
              <p className="mt-0.5 text-[#78908b]">Registration closes</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <UsersRound size={15} className="mt-0.5 shrink-0 text-[#3c8b76]" />
            <div>
              <p className="font-semibold text-[#365853]">
                {event.registeredCount} of {event.capacity || '—'} registered
              </p>
              <p className="mt-0.5 text-[#78908b]">{full ? 'No places left' : `${remaining} places remaining`}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87a09a]">
              Available consists
            </p>
            <span className="text-[11px] font-medium text-[#78908b]">{event.trains?.length || 0} options</span>
          </div>
          <div className="grid gap-2">
            {event.trains?.length ? event.trains.map(train => <TrainSummary key={train.name} train={train} />) : (
              <p className="rounded-xl border border-dashed border-[#ccdcd6] px-4 py-4 text-sm text-[#78908b]">
                Train details will be shared by the event host.
              </p>
            )}
          </div>
        </div>

        {!!event.consistRequirements?.length && (
          <div className="mt-4 rounded-xl bg-[#f5f0e6] px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9a7854]">Before you board</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[#735d44]">
              {event.consistRequirements.map(requirement => (
                <li key={requirement} className="flex gap-2">
                  <Check size={13} className="mt-1 shrink-0 text-[#b07a3e]" />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#78908b]">
            {username ? <>Signed in as <span className="font-semibold text-[#365853]">@{username}</span></> : 'Sign in with your community username to register.'}
          </p>
          <Button
            type="button"
            onClick={() => onRegister(event)}
            disabled={full || !event.trains?.length}
            className="h-10 gap-2 rounded-lg bg-[#286c5b] px-4 text-sm font-semibold text-[#f8fffb] shadow-none hover:bg-[#1f5b4c] disabled:bg-[#b5c3be]"
          >
            {full ? 'Event is full' : 'Reserve my place'}
            {!full && <ArrowRight size={15} />}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export default function EventPortal() {
  const {
    events,
    routes,
    eventsLoading,
    error: storeError,
    loadEvents,
    registerForEvent,
  } = useMsts();
  const [username, setUsername] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginValue, setLoginValue] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduledEvent | null>(null);
  const [registration, setRegistration] = useState<RegistrationForm>(emptyRegistration);
  const [registrationError, setRegistrationError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState<EventRegistration | null>(null);
  const [loadAttempted, setLoadAttempted] = useState(false);

  useEffect(() => {
    const storedUsername = window.sessionStorage.getItem(SESSION_USERNAME_KEY);
    if (storedUsername) setUsername(storedUsername);
    setSessionReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadEvents().finally(() => {
      if (mounted) setLoadAttempted(true);
    });
    return () => { mounted = false; };
  }, [loadEvents]);

  const visibleEvents = useMemo(
    () => events.filter(event => !isEventExpired(event)).sort((a, b) => {
      const first = a.startDateTime ? new Date(a.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
      const second = b.startDateTime ? new Date(b.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
      return first - second;
    }),
    [events],
  );

  const selectedTrain = selectedEvent?.trains.find(train => train.name === registration.trainName);
  const selectedRoute = selectedEvent ? routeLabel(selectedEvent.routeId, routes) : '';

  const openRegistration = (event: ScheduledEvent) => {
    if (isEventExpired(event) || event.registeredCount >= event.capacity) return;
    setSelectedEvent(event);
    setRegistration(emptyRegistration());
    setRegistrationError('');
    setSuccess(null);
    if (!username) {
      setLoginValue('');
      setLoginError('');
      setLoginOpen(true);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    const value = loginValue.trim();
    if (!value) {
      setLoginError('Enter your community username to continue.');
      return;
    }
    try {
      setLoggingIn(true);
      setLoginError('');
      const verified = await apiEventUsers.login(value);
      const verifiedUsername = verified.username || value;
      window.sessionStorage.setItem(SESSION_USERNAME_KEY, verifiedUsername);
      setUsername(verifiedUsername);
      setLoginOpen(false);
    } catch (loginFailure) {
      setLoginError(getErrorMessage(loginFailure));
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    window.sessionStorage.removeItem(SESSION_USERNAME_KEY);
    setUsername('');
    setSelectedEvent(null);
    setSuccess(null);
  };

  const handleRegistration = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEvent || !username || !selectedTrain) {
      setRegistrationError('Choose one of the available trains before continuing.');
      return;
    }
    if (!registration.startPoint.trim() || !registration.endPoint.trim()) {
      setRegistrationError('Add your boarding and alighting points to complete the manifest.');
      return;
    }
    if (isEventExpired(selectedEvent)) {
      setRegistrationError('Registration for this event has closed.');
      return;
    }
    if (selectedEvent.capacity > 0 && selectedEvent.registeredCount >= selectedEvent.capacity) {
      setRegistrationError('This event has reached capacity. Please choose another run.');
      return;
    }
    try {
      setRegistering(true);
      setRegistrationError('');
      const created = await registerForEvent(selectedEvent.id, {
        username,
        name: registration.name.trim(),
        email: registration.email.trim(),
        phone: registration.phone.trim(),
        trainName: selectedTrain.name,
        startPoint: registration.startPoint.trim(),
        endPoint: registration.endPoint.trim(),
      });
      setSuccess(created);
    } catch (registrationFailure) {
      setRegistrationError(getErrorMessage(registrationFailure));
    } finally {
      setRegistering(false);
    }
  };

  const closeRegistration = () => {
    if (!registering) {
      setSelectedEvent(null);
      setSuccess(null);
      setRegistrationError('');
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#f4f1e9] text-[#183a3a]">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:radial-gradient(#b8c9c1_0.7px,transparent_0.7px)] [background-size:18px_18px]" />
      <div className="relative">
        <header className="border-b border-[#dce5df] bg-[#f8f7f2]/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#286c5b] text-[#f4f1e9] shadow-[0_5px_14px_rgba(40,108,91,0.18)]">
                <TrainFront size={21} strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-display text-sm font-bold tracking-[0.12em] text-[#183a3a]">MSTS COMMUNITY</p>
                <p className="text-[11px] font-medium text-[#78908b]">Event registration desk</p>
              </div>
            </div>
            {sessionReady && (
              username ? (
                <div className="flex items-center gap-2.5">
                  <span className="hidden text-xs text-[#607875] sm:inline">Signed in as <strong className="text-[#365853]">@{username}</strong></span>
                  <Button type="button" variant="outline" onClick={logout} className="h-9 gap-2 rounded-lg border-[#cbdad4] bg-[#fffdf9] text-xs text-[#42645d] hover:bg-[#edf6f1]">
                    <LogOut size={14} /> Log out
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={() => setLoginOpen(true)} className="h-9 gap-2 rounded-lg border-[#cbdad4] bg-[#fffdf9] text-xs text-[#42645d] hover:bg-[#edf6f1]">
                  <LogIn size={14} /> Participant sign in
                </Button>
              )
            )}
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-16">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_360px]">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c9ddd5] bg-[#edf7f2] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#327a67]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3c8b76]" />
                Open runs
              </div>
              <h1 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.3rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#183a3a]">
                Find your next
                <span className="block text-[#327a67]">railway run.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#607875] sm:text-lg">
                Join fellow MSTS operators on a shared route. Pick your consist, tell the dispatcher where you will board, and receive the details you need for departure.
              </p>
            </div>
            <div className="rounded-2xl border border-[#d6e3dd] bg-[#e8f1ec] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#cfe5db] text-[#286c5b]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#285548]">A simple, trusted check-in</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#5d7a70]">
                    Browsing is open to everyone. Registration uses your verified community username—no password is needed here.
                  </p>
                </div>
              </div>
              {!username && (
                <Button type="button" onClick={() => setLoginOpen(true)} className="mt-4 h-9 w-full gap-2 rounded-lg bg-[#286c5b] text-xs font-semibold text-[#f8fffb] shadow-none hover:bg-[#1f5b4c]">
                  Sign in to reserve a place <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#7f9991]">The timetable</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.035em] text-[#183a3a] sm:text-3xl">
                Current &amp; upcoming events
              </h2>
            </div>
            {!eventsLoading && visibleEvents.length > 0 && (
              <p className="text-xs font-medium text-[#78908b]">{visibleEvents.length} scheduled {visibleEvents.length === 1 ? 'run' : 'runs'}</p>
            )}
          </div>

          {eventsLoading || !loadAttempted ? (
            <EventSkeleton />
          ) : storeError && !events.length ? (
            <div className="rounded-2xl border border-[#e5c5ad] bg-[#fff8f0] px-6 py-12 text-center">
              <CircleAlert size={23} className="mx-auto text-[#b36c3f]" />
              <h3 className="mt-3 text-base font-semibold text-[#74452e]">The timetable could not be loaded</h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#93694f]">{storeError}</p>
              <Button type="button" variant="outline" onClick={() => { setLoadAttempted(false); void loadEvents().finally(() => setLoadAttempted(true)); }} className="mt-5 gap-2 border-[#e2c3a9] bg-[#fffaf4] text-[#8a583b] hover:bg-[#fff1e1]">
                <RefreshCw size={14} /> Try again
              </Button>
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbdcd5] bg-[#f8faf6] px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3eee8] text-[#43806d]">
                <CalendarDays size={22} />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-[#365853]">No open runs just yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#78908b]">
                The next timetable is being planned. Check back soon for a new route, consist, and departure window.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {visibleEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    route={routeLabel(event.routeId, routes)}
                    username={username}
                    onRegister={openRegistration}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      <Dialog open={loginOpen} onOpenChange={open => { if (!loggingIn) setLoginOpen(open); }}>
        <DialogContent className="max-w-md rounded-2xl border-[#d6e3dd] bg-[#fffdf9] p-6 sm:p-7">
          <DialogHeader>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e2f1eb] text-[#286c5b]">
              <UserRound size={19} />
            </div>
            <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.03em] text-[#183a3a]">Participant sign in</DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-[#607875]">
              Enter the username used for your MSTS community account. We will verify it before opening registration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="mt-3 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-username" className="text-xs font-semibold text-[#42645d]">Community username</Label>
              <Input
                id="event-username"
                autoFocus
                value={loginValue}
                onChange={event => setLoginValue(event.target.value)}
                placeholder="e.g. railfan_92"
                className="h-11 rounded-lg border-[#cbdad4] bg-[#fbfcf9]"
              />
            </div>
            {loginError && <p className="rounded-lg border border-[#e7c6ae] bg-[#fff5ed] px-3 py-2.5 text-xs leading-5 text-[#955832]">{loginError}</p>}
            <Button type="submit" disabled={loggingIn} className="h-11 w-full gap-2 rounded-lg bg-[#286c5b] font-semibold text-[#f8fffb] shadow-none hover:bg-[#1f5b4c]">
              {loggingIn ? 'Checking username…' : 'Continue to registration'}
              {!loggingIn && <ArrowRight size={15} />}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEvent && !!username} onOpenChange={open => { if (!open) closeRegistration(); }}>
        <DialogContent className="max-w-2xl rounded-2xl border-[#d6e3dd] bg-[#fffdf9] p-0">
          {selectedEvent && (
            success ? (
              <div className="p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d9eee5] text-[#286c5b]">
                  <Check size={25} strokeWidth={2.5} />
                </div>
                <DialogHeader className="mt-5">
                  <DialogTitle className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#183a3a]">You are on the manifest.</DialogTitle>
                  <DialogDescription className="pt-2 text-sm leading-6 text-[#607875]">
                    Your place for <strong className="font-semibold text-[#365853]">{selectedEvent.name}</strong> is confirmed under <strong className="font-semibold text-[#365853]">@{username}</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#f1f7f3] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7f9991]">Departure</p>
                    <p className="mt-1.5 text-sm font-semibold text-[#365853]">{formatDateTime(selectedEvent.startDateTime)}</p>
                  </div>
                  <div className="rounded-xl bg-[#f1f7f3] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7f9991]">Your train</p>
                    <p className="mt-1.5 text-sm font-semibold text-[#365853]">{success.trainName}</p>
                    <p className="mt-1 text-xs text-[#78908b]">{success.startPoint} <ArrowRight className="mx-1 inline" size={11} /> {success.endPoint}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {selectedTrain?.driveLink && (
                    <a href={selectedTrain.driveLink} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#cbdad4] bg-[#fbfcf9] px-4 text-sm font-semibold text-[#327a67] hover:bg-[#edf6f1]">
                      Open Drive link <ExternalLink size={14} />
                    </a>
                  )}
                  {selectedEvent.discordLink && (
                    <a href={selectedEvent.discordLink} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#286c5b] px-4 text-sm font-semibold text-[#f8fffb] hover:bg-[#1f5b4c]">
                      Join event Discord <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e7ece9] pt-5">
                  <p className="text-xs leading-5 text-[#78908b]">Keep these links handy for the day of the run.</p>
                  <Button type="button" onClick={closeRegistration} className="shrink-0 gap-2 rounded-lg bg-[#183a3a] text-[#f8fffb] shadow-none hover:bg-[#234b49]">Done <Check size={14} /></Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegistration} className="p-6 sm:p-8">
                <DialogHeader>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Badge variant="outline" className="border-[#b9d8cf] bg-[#edf8f3] text-[11px] font-semibold text-[#276b57]">Registering as @{username}</Badge>
                    <span className="text-xs text-[#78908b]">{selectedRoute}</span>
                  </div>
                  <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.035em] text-[#183a3a]">Reserve your place</DialogTitle>
                  <DialogDescription className="pt-1 text-sm leading-6 text-[#607875]">
                    Choose one train and tell the dispatcher where you will join and leave the run.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-train" className="text-xs font-semibold text-[#42645d]">Choose your train <span className="text-[#b36c3f]">*</span></Label>
                    <Select value={registration.trainName} onValueChange={value => setRegistration(current => ({ ...current, trainName: value }))}>
                      <SelectTrigger id="event-train" className="h-11 rounded-lg border-[#cbdad4] bg-[#fbfcf9]">
                        <SelectValue placeholder="Select an available train" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedEvent.trains.map(train => <SelectItem key={train.name} value={train.name}>{train.name} · {train.startPoint} → {train.endPoint}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTrain && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#cfe2d9] bg-[#f1f8f4] p-4">
                      <div className="flex items-start gap-3">
                        <TrainFront size={17} className="mt-0.5 shrink-0 text-[#327a67]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#365853]">{selectedTrain.name}</p>
                          <p className="mt-1 text-xs text-[#607875]">Route: {selectedTrain.startPoint} <ArrowRight className="mx-1 inline" size={11} /> {selectedTrain.endPoint}</p>
                        </div>
                        <a href={selectedTrain.driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#327a67] hover:text-[#1f5b4c]">Drive <ExternalLink size={12} /></a>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="event-start-point" className="text-xs font-semibold text-[#42645d]">Your start point <span className="text-[#b36c3f]">*</span></Label>
                      <Input id="event-start-point" value={registration.startPoint} onChange={event => setRegistration(current => ({ ...current, startPoint: event.target.value }))} placeholder="Where will you board?" className="h-11 rounded-lg border-[#cbdad4] bg-[#fbfcf9]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-end-point" className="text-xs font-semibold text-[#42645d]">Your end point <span className="text-[#b36c3f]">*</span></Label>
                      <Input id="event-end-point" value={registration.endPoint} onChange={event => setRegistration(current => ({ ...current, endPoint: event.target.value }))} placeholder="Where will you leave?" className="h-11 rounded-lg border-[#cbdad4] bg-[#fbfcf9]" />
                    </div>
                  </div>

                  <div className="border-t border-[#e7ece9] pt-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7f9991]">Optional contact details</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input aria-label="Name (optional)" value={registration.name} onChange={event => setRegistration(current => ({ ...current, name: event.target.value }))} placeholder="Name" className="h-10 rounded-lg border-[#cbdad4] bg-[#fbfcf9]" />
                      <Input aria-label="Email (optional)" type="email" value={registration.email} onChange={event => setRegistration(current => ({ ...current, email: event.target.value }))} placeholder="Email" className="h-10 rounded-lg border-[#cbdad4] bg-[#fbfcf9]" />
                      <Input aria-label="Phone (optional)" value={registration.phone} onChange={event => setRegistration(current => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="h-10 rounded-lg border-[#cbdad4] bg-[#fbfcf9]" />
                    </div>
                  </div>
                </div>

                {registrationError && <p className="mt-4 rounded-lg border border-[#e7c6ae] bg-[#fff5ed] px-3 py-2.5 text-xs leading-5 text-[#955832]">{registrationError}</p>}
                <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#e7ece9] pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeRegistration} disabled={registering} className="h-10 rounded-lg border-[#cbdad4] bg-[#fffdf9] text-[#42645d]">Not yet</Button>
                  <Button type="submit" disabled={registering || !selectedTrain} className="h-10 gap-2 rounded-lg bg-[#286c5b] px-5 font-semibold text-[#f8fffb] shadow-none hover:bg-[#1f5b4c]">
                    {registering ? 'Saving your place…' : 'Confirm registration'}
                    {!registering && <Check size={15} />}
                  </Button>
                </div>
              </form>
            )
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}