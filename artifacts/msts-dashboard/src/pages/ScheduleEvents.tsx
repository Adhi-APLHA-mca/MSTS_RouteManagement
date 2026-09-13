import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  Loader2,
  Mail,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrainFront,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMsts } from '@/store/msts-store';
import type {
  EventRegistration,
  EventRegistrationPayload,
  EventTrain,
  ScheduledEvent,
  ScheduledEventPayload,
} from '@/lib/api';

type EventStatus = 'active' | 'full' | 'expired';

type EventFormState = {
  name: string;
  description: string;
  routeId: string;
  capacity: string;
  trains: EventTrain[];
  consistRequirements: string[];
  expiryDate: string;
  startDateTime: string;
  discordLink: string;
};

const emptyTrain = (): EventTrain => ({ name: '', driveLink: '', startPoint: '', endPoint: '' });

const emptyForm = (routeId = ''): EventFormState => ({
  name: '',
  description: '',
  routeId,
  capacity: '12',
  trains: [emptyTrain()],
  consistRequirements: [''],
  expiryDate: '',
  startDateTime: '',
  discordLink: '',
});

function getEventStatus(event: ScheduledEvent): EventStatus {
  if (event.expiryDate && event.expiryDate < new Date().toISOString().slice(0, 10)) return 'expired';
  if (event.registeredCount >= event.capacity) return 'full';
  return 'active';
}

function formatDate(value: string) {
  if (!value) return 'No expiry set';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  if (!value) return 'Start time to be announced';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getRouteName(routeId: string, routes: { id: string; name: string; code: string }[]) {
  const route = routes.find(item => item.id === routeId);
  return route ? `${route.name} · ${route.code}` : 'Route unavailable';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

function normalizeTrainName(name: string) {
  return name.trim().toLowerCase();
}

function StatusBadge({ status }: { status: EventStatus }) {
  const copy = {
    active: { label: 'Active', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Check },
    full: { label: 'At capacity', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: ShieldCheck },
    expired: { label: 'Expired', className: 'border-slate-200 bg-slate-100 text-slate-600', icon: Clock3 },
  }[status];
  const Icon = copy.icon;
  return (
    <Badge data-testid={`status-event-${status}`} variant="outline" className={`gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${copy.className}`}>
      <Icon size={12} strokeWidth={2.5} />
      {copy.label}
    </Badge>
  );
}

function EventForm({
  event,
  routeOptions,
  submitting,
  onSubmit,
  onCancel,
}: {
  event?: ScheduledEvent;
  routeOptions: { id: string; name: string; code: string }[];
  submitting: boolean;
  onSubmit: (payload: ScheduledEventPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EventFormState>(() => event ? {
    name: event.name,
    description: event.description || '',
    routeId: event.routeId,
    capacity: String(event.capacity),
    trains: event.trains?.length ? event.trains : [emptyTrain()],
    consistRequirements: event.consistRequirements?.length ? event.consistRequirements : [''],
    expiryDate: event.expiryDate || '',
    startDateTime: event.startDateTime || '',
    discordLink: event.discordLink || '',
  } : emptyForm(routeOptions[0]?.id || ''));
  const [formError, setFormError] = useState('');

  const setField = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const updateTrain = (index: number, field: keyof EventTrain, value: string) => {
    setField('trains', form.trains.map((train, trainIndex) => trainIndex === index ? { ...train, [field]: value } : train));
  };

  const updateRequirement = (index: number, value: string) => {
    setField('consistRequirements', form.consistRequirements.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTrains = form.trains
      .map(train => ({
        name: train.name.trim(),
        driveLink: train.driveLink.trim(),
        startPoint: train.startPoint.trim(),
        endPoint: train.endPoint.trim(),
      }))
      .filter(train => train.name || train.driveLink);
    const cleanRequirements = form.consistRequirements.map(item => item.trim()).filter(Boolean);
    if (!form.name.trim() || !form.routeId || !form.expiryDate || Number(form.capacity) < 1) {
      setFormError('Name, route, capacity, and expiry date are required.');
      return;
    }
    if (!cleanTrains.length || cleanTrains.some(train => !train.name || !train.driveLink || !train.startPoint || !train.endPoint)) {
      setFormError('Add a train with its Drive path, start point, and end point.');
      return;
    }
    setFormError('');
    await onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      routeId: form.routeId,
      capacity: Number(form.capacity),
      trains: cleanTrains,
      consistRequirements: cleanRequirements,
      expiryDate: form.expiryDate,
      startDateTime: form.startDateTime,
      discordLink: form.discordLink.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <div className="space-y-2">
          <Label htmlFor="event-name">Event name <span className="text-destructive">*</span></Label>
          <Input data-testid="input-event-name" id="event-name" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Western Division Night Run" autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-capacity">Capacity <span className="text-destructive">*</span></Label>
          <Input data-testid="input-event-capacity" id="event-capacity" type="number" min="1" max="999" value={form.capacity} onChange={e => setField('capacity', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-description">Dispatch note <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea data-testid="input-event-description" id="event-description" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="What should operators know before opening registration?" className="min-h-[76px] resize-none" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event-route">Route <span className="text-destructive">*</span></Label>
          <Select value={form.routeId} onValueChange={value => setField('routeId', value)} disabled={!routeOptions.length}>
            <SelectTrigger data-testid="select-event-route" id="event-route">
              <SelectValue placeholder={routeOptions.length ? 'Select route' : 'No routes available'} />
            </SelectTrigger>
            <SelectContent>
              {routeOptions.map(route => <SelectItem data-testid={`option-route-${route.id}`} key={route.id} value={route.id}>{route.name} · {route.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-expiry">Registration closes <span className="text-destructive">*</span></Label>
          <Input data-testid="input-event-expiry" id="event-expiry" type="date" value={form.expiryDate} onChange={e => setField('expiryDate', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-start">Event start date &amp; time <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input data-testid="input-event-start" id="event-start" type="datetime-local" value={form.startDateTime} onChange={e => setField('startDateTime', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-discord">Discord channel link <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input data-testid="input-event-discord" id="event-discord" type="url" value={form.discordLink} onChange={e => setField('discordLink', e.target.value)} placeholder="https://discord.gg/…" />
        </div>
      </div>

      <section className="space-y-3 border-t border-border/70 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Train consist</h3>
            <p className="text-xs text-muted-foreground">Add the available train and its Drive path.</p>
          </div>
          <Button data-testid="button-add-train" type="button" size="sm" variant="outline" onClick={() => setField('trains', [...form.trains, emptyTrain()])} className="gap-1.5">
            <Plus size={13} /> Add train
          </Button>
        </div>
        <div className="space-y-2.5">
          {form.trains.map((train, index) => (
              <div data-testid={`row-train-${index}`} key={`train-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Input data-testid={`input-train-name-${index}`} value={train.name} onChange={e => updateTrain(index, 'name', e.target.value)} placeholder="Train name" />
              <Input data-testid={`input-train-drive-${index}`} value={train.driveLink} onChange={e => updateTrain(index, 'driveLink', e.target.value)} placeholder="Drive path or link" />
               <Input data-testid={`input-train-start-${index}`} value={train.startPoint} onChange={e => updateTrain(index, 'startPoint', e.target.value)} placeholder="Start point" />
               <Input data-testid={`input-train-end-${index}`} value={train.endPoint} onChange={e => updateTrain(index, 'endPoint', e.target.value)} placeholder="End point" />
              <Button data-testid={`button-remove-train-${index}`} type="button" variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:mt-0.5" onClick={() => setField('trains', form.trains.filter((_, trainIndex) => trainIndex !== index))} disabled={form.trains.length === 1} aria-label="Remove train">
                <X size={15} />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Consist requirements</h3>
            <p className="text-xs text-muted-foreground">Optional checks for drivers before sign-up.</p>
          </div>
          <Button data-testid="button-add-requirement" type="button" size="sm" variant="outline" onClick={() => setField('consistRequirements', [...form.consistRequirements, ''])} className="gap-1.5">
            <Plus size={13} /> Add requirement
          </Button>
        </div>
        <div className="space-y-2">
          {form.consistRequirements.map((requirement, index) => (
            <div data-testid={`row-requirement-${index}`} key={`requirement-${index}`} className="flex gap-2">
              <Input data-testid={`input-requirement-${index}`} value={requirement} onChange={e => updateRequirement(index, e.target.value)} placeholder="e.g. Owns the Western Lines route" />
              <Button data-testid={`button-remove-requirement-${index}`} type="button" variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setField('consistRequirements', form.consistRequirements.filter((_, requirementIndex) => requirementIndex !== index))} disabled={form.consistRequirements.length === 1} aria-label="Remove requirement">
                <X size={15} />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {formError && <p data-testid="status-event-form-error" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{formError}</p>}

      <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
        <Button data-testid="button-cancel-event" type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button data-testid="button-submit-event" type="submit" disabled={submitting || !routeOptions.length} className="min-w-[126px] gap-2">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {event ? 'Save changes' : 'Create event'}
        </Button>
      </div>
    </form>
  );
}

function RegistrationRow({
  eventId,
  registration,
  onRemove,
}: {
  eventId: string;
  registration: EventRegistration;
  onRemove: (eventId: string, registrationId: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${registration.name} from this event?`)) return;
    try {
      setRemoving(true);
      await onRemove(eventId, registration.id);
      toast({ title: 'Registration removed', description: `${registration.name} is no longer on the manifest.` });
    } catch (error) {
      toast({ title: 'Could not remove registration', description: getErrorMessage(error), variant: 'destructive' });
      setRemoving(false);
    }
  };

  return (
    <div data-testid={`row-registration-${registration.id}`} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7eef9] text-xs font-bold text-[#27466f]">
        {registration.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p data-testid={`text-registration-name-${registration.id}`} className="truncate text-sm font-medium">{registration.name}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-[#395878]">@{registration.username}</span>
          <span className="inline-flex items-center gap-1"><Mail size={11} /> {registration.email}</span>
          {registration.phone && <span>{registration.phone}</span>}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {registration.trainName} · {registration.startPoint} → {registration.endPoint}
        </p>
      </div>
      <Button data-testid={`button-remove-registration-${registration.id}`} variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={handleRemove} disabled={removing} aria-label={`Remove ${registration.name}`}>
        {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </Button>
    </div>
  );
}

function EventCard({
  event,
  routeName,
  registrations,
  expanded,
  registrationsLoading,
  onToggle,
  onEdit,
  onDelete,
  onLoadRegistrations,
  onRegister,
  onRemoveRegistration,
}: {
  event: ScheduledEvent;
  routeName: string;
  registrations?: EventRegistration[];
  expanded: boolean;
  registrationsLoading: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onLoadRegistrations: () => Promise<void>;
  onRegister: (data: EventRegistrationPayload) => Promise<void>;
  onRemoveRegistration: (eventId: string, registrationId: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [manifestError, setManifestError] = useState('');
  const [registrationForm, setRegistrationForm] = useState<EventRegistrationPayload>({
    username: '',
    name: '',
    email: '',
    phone: '',
    trainName: '',
    startPoint: '',
    endPoint: '',
  });
  const status = getEventStatus(event);
  const occupiedTrainNames = new Set((registrations || []).map(registration => normalizeTrainName(registration.trainName)));
  const availableTrains = event.trains.filter(train => !occupiedTrainNames.has(normalizeTrainName(train.name)));
  const remaining = Math.max(0, event.capacity - event.registeredCount);
  const fillPercentage = Math.min(100, Math.round((event.registeredCount / Math.max(event.capacity, 1)) * 100));

  const handleToggle = async () => {
    onToggle();
    if (!expanded && !registrations) {
      try {
        setManifestError('');
        await onLoadRegistrations();
      } catch (error) {
        setManifestError(getErrorMessage(error));
        toast({ title: 'Could not load manifest', description: getErrorMessage(error), variant: 'destructive' });
      }
    }
  };

  const handleRetryManifest = async () => {
    try {
      setManifestError('');
      await onLoadRegistrations();
    } catch (error) {
      setManifestError(getErrorMessage(error));
      toast({ title: 'Could not load manifest', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!registrationForm.username.trim() || !registrationForm.name.trim() || !registrationForm.trainName || !registrationForm.startPoint.trim() || !registrationForm.endPoint.trim()) return;
    try {
      setRegistering(true);
      await onRegister({
        ...registrationForm,
        username: registrationForm.username.trim(),
        name: registrationForm.name.trim(),
        email: registrationForm.email.trim(),
        phone: registrationForm.phone.trim(),
        startPoint: registrationForm.startPoint.trim(),
        endPoint: registrationForm.endPoint.trim(),
      });
      setRegistrationForm({ username: '', name: '', email: '', phone: '', trainName: '', startPoint: '', endPoint: '' });
      toast({ title: 'Driver added', description: `${registrationForm.name.trim()} is on the driver manifest.` });
    } catch (error) {
      toast({ title: 'Could not register driver', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete “${event.name}”? This will remove its registration manifest.`)) return;
    try {
      setDeleting(true);
      await onDelete();
      toast({ title: 'Event deleted', description: `${event.name} has been removed.` });
    } catch (error) {
      toast({ title: 'Could not delete event', description: getErrorMessage(error), variant: 'destructive' });
      setDeleting(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      data-testid={`card-event-${event.id}`}
      className={`overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(34,55,82,0.04)] transition-shadow hover:shadow-[0_8px_28px_rgba(34,55,82,0.08)] ${status === 'expired' ? 'border-border/70' : 'border-[#d8e1ee]'}`}
    >
      <div className="relative p-5 sm:p-6">
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#476fa8]" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 pl-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">EVT-{event.id.slice(-6).toUpperCase()}</span>
            </div>
            <h2 data-testid={`text-event-name-${event.id}`} className="text-[19px] font-bold tracking-[-0.02em] text-[#1f3048]">{event.name}</h2>
            {event.description && <p data-testid={`text-event-description-${event.id}`} className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{event.description}</p>}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span data-testid={`text-event-route-${event.id}`} className="inline-flex items-center gap-1.5 font-medium text-[#395878]"><MapPinned size={13} className="text-[#5f82ad]" /> {routeName}</span>
              <span data-testid={`text-event-start-${event.id}`} className="inline-flex items-center gap-1.5"><CalendarClock size={13} /> Starts {formatDateTime(event.startDateTime)}</span>
              <span data-testid={`text-event-expiry-${event.id}`} className="inline-flex items-center gap-1.5"><Clock3 size={13} /> Closes {formatDate(event.expiryDate)}</span>
              <span data-testid={`text-event-train-count-${event.id}`} className="inline-flex items-center gap-1.5"><TrainFront size={13} /> {event.trains?.length || 0} train{event.trains?.length === 1 ? '' : 's'}</span>
              {event.discordLink && <a href={event.discordLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">Discord</a>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 self-end lg:self-start">
            <Button data-testid={`button-edit-event-${event.id}`} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onEdit}><Pencil size={14} /> Edit</Button>
            <Button data-testid={`button-delete-event-${event.id}`} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} <span className="sr-only sm:not-sr-only">Delete</span></Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#2d4563]"><span data-testid={`text-event-registered-${event.id}`}>{event.registeredCount}</span> registered</span>
              <span data-testid={`text-event-capacity-${event.id}`} className="text-muted-foreground">{remaining} place{remaining === 1 ? '' : 's'} remaining <span className="font-mono text-[11px]">/ {event.capacity}</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e7edf5]" aria-label={`${fillPercentage}% capacity used`}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${fillPercentage}%` }} transition={{ duration: 0.45, ease: 'easeOut' }} className={`h-full rounded-full ${status === 'full' ? 'bg-amber-500' : status === 'expired' ? 'bg-slate-400' : 'bg-[#557ead]'}`} />
            </div>
          </div>
          <Button data-testid={`button-toggle-registrations-${event.id}`} variant="outline" size="sm" onClick={handleToggle} className="gap-2 border-[#d8e1ee] bg-[#f8fafc] text-[#395878] hover:bg-[#eef4fb]">
            <Users size={14} />
            {expanded ? 'Hide manifest' : 'View manifest'}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-[#dbe5f0] bg-[#f8fafc]">
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_340px]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7890aa]">Driver manifest</p>
                    <p className="mt-1 text-xs text-muted-foreground">{registrations?.length || 0} record{registrations?.length === 1 ? '' : 's'} loaded</p>
                  </div>
                  <div className="rounded-md bg-[#eaf1f8] px-2 py-1 font-mono text-[11px] text-[#4e6c8d]">CAP {event.capacity}</div>
                </div>
                {registrationsLoading ? (
                  <div data-testid={`status-loading-registrations-${event.id}`} className="space-y-2 py-3">
                    {[1, 2].map(item => <div key={item} className="flex items-center gap-3 py-2"><div className="h-8 w-8 animate-pulse rounded-full bg-[#e4ebf4]" /><div className="h-8 flex-1 animate-pulse rounded bg-[#e4ebf4]" /></div>)}
                  </div>
                ) : manifestError ? (
                  <div data-testid={`status-registrations-error-${event.id}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-7 text-center">
                    <CircleAlert size={20} className="mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium text-amber-900">Manifest unavailable</p>
                    <p className="mt-1 text-xs text-amber-800/75">{manifestError}</p>
                    <Button data-testid={`button-retry-registrations-${event.id}`} type="button" variant="outline" size="sm" className="mt-3 gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" onClick={handleRetryManifest}><RefreshCw size={12} /> Retry</Button>
                  </div>
                ) : registrations?.length ? (
                  <div className="divide-y divide-border/60">{registrations.map(registration => <RegistrationRow key={registration.id} eventId={event.id} registration={registration} onRemove={onRemoveRegistration} />)}</div>
                ) : (
                  <div data-testid={`empty-registrations-${event.id}`} className="rounded-xl border border-dashed border-[#cbd8e7] bg-card px-4 py-8 text-center">
                    <Users size={22} className="mx-auto mb-2 text-[#9aacc0]" />
                    <p className="text-sm font-medium text-[#45617f]">Manifest is clear</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add the first driver using the form.</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleRegister} className="rounded-xl border border-[#d6e2ef] bg-card p-4 shadow-[0_1px_2px_rgba(34,55,82,0.03)]">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f0f8] text-[#5279a3]"><UserPlus size={14} /></div>
                  <div><p className="text-sm font-semibold text-[#2d4563]">Add driver</p><p className="text-[11px] text-muted-foreground">Reserve one driver place on this run.</p></div>
                </div>
                <div className="space-y-3">
                  <Input data-testid={`input-registration-username-${event.id}`} value={registrationForm.username} onChange={e => setRegistrationForm(current => ({ ...current, username: e.target.value }))} placeholder="Firebase username" required />
                  <Input data-testid={`input-registration-name-${event.id}`} value={registrationForm.name} onChange={e => setRegistrationForm(current => ({ ...current, name: e.target.value }))} placeholder="Full name" required />
                  <Input data-testid={`input-registration-email-${event.id}`} type="email" value={registrationForm.email} onChange={e => setRegistrationForm(current => ({ ...current, email: e.target.value }))} placeholder="Email address (optional)" />
                  <Input data-testid={`input-registration-phone-${event.id}`} value={registrationForm.phone} onChange={e => setRegistrationForm(current => ({ ...current, phone: e.target.value }))} placeholder="Phone number (optional)" />
                  <Select value={registrationForm.trainName} onValueChange={value => setRegistrationForm(current => ({ ...current, trainName: value }))}>
                    <SelectTrigger data-testid={`select-registration-train-${event.id}`}><SelectValue placeholder="Choose a train" /></SelectTrigger>
                    <SelectContent>{availableTrains.map(train => <SelectItem key={train.name} value={train.name}>{train.name} · {train.startPoint} → {train.endPoint}</SelectItem>)}</SelectContent>
                  </Select>
                  {!availableTrains.length && <p className="text-xs text-amber-700">All trains in this event are already assigned.</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <Input data-testid={`input-registration-start-${event.id}`} value={registrationForm.startPoint} onChange={e => setRegistrationForm(current => ({ ...current, startPoint: e.target.value }))} placeholder="Your start point" required />
                    <Input data-testid={`input-registration-end-${event.id}`} value={registrationForm.endPoint} onChange={e => setRegistrationForm(current => ({ ...current, endPoint: e.target.value }))} placeholder="Your end point" required />
                  </div>
                  <Button data-testid={`button-register-event-${event.id}`} type="submit" className="w-full gap-2" disabled={registering || status !== 'active'}>{registering ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{status === 'active' ? 'Add to manifest' : 'Registration closed'}</Button>
                </div>
              </form>
            </div>
            {!!event.consistRequirements?.length && (
              <div className="border-t border-[#dbe5f0] px-5 py-3 sm:px-6">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7890aa]">Consist requirements</p>
                <div className="flex flex-wrap gap-2">{event.consistRequirements.map((requirement, index) => <span data-testid={`text-requirement-${event.id}-${index}`} key={`${event.id}-requirement-${index}`} className="inline-flex items-center gap-1.5 rounded-md bg-[#eaf1f8] px-2 py-1 text-xs text-[#4a6684]"><Check size={11} /> {requirement}</span>)}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function EventSkeleton() {
  return (
    <div data-testid="status-loading-events" className="space-y-3" aria-label="Loading scheduled events">
      {[1, 2, 3].map(item => <div key={item} className="rounded-2xl border border-border/60 bg-card p-6"><div className="flex justify-between gap-4"><div className="w-2/3 space-y-3"><div className="h-3 w-20 animate-pulse rounded bg-muted" /><div className="h-6 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div><div className="h-8 w-20 animate-pulse rounded bg-muted" /></div><div className="mt-6 h-2 animate-pulse rounded bg-muted" /></div>)}
    </div>
  );
}

export function ScheduleEvents() {
  const {
    routes,
    events,
    eventsLoading,
    eventRegistrations,
    error,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    loadEventRegistrations,
    registerForEvent,
    removeEventRegistration,
  } = useMsts();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduledEvent>();
  const [submitting, setSubmitting] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const orderedEvents = useMemo(() => [...events].sort((a, b) => {
    const statusOrder = { active: 0, full: 1, expired: 2 };
    const statusDifference = statusOrder[getEventStatus(a)] - statusOrder[getEventStatus(b)];
    return statusDifference || a.expiryDate.localeCompare(b.expiryDate);
  }), [events]);

  const stats = useMemo(() => ({
    total: events.length,
    active: events.filter(event => getEventStatus(event) === 'active').length,
    registered: events.reduce((total, event) => total + event.registeredCount, 0),
    openPlaces: events.reduce((total, event) => total + Math.max(0, event.capacity - event.registeredCount), 0),
  }), [events]);

  const openCreate = () => {
    setEditingEvent(undefined);
    setDialogOpen(true);
  };

  const openEdit = (event: ScheduledEvent) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload: ScheduledEventPayload) => {
    try {
      setSubmitting(true);
      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
        toast({ title: 'Event updated', description: `${payload.name} is ready for dispatch.` });
      } else {
        await createEvent(payload);
        toast({ title: 'Event scheduled', description: `${payload.name} is now available for registration.` });
      }
      setDialogOpen(false);
    } catch (submitError) {
      toast({ title: editingEvent ? 'Could not update event' : 'Could not schedule event', description: getErrorMessage(submitError), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRegistrations = (eventId: string) => {
    setExpandedEventId(current => current === eventId ? null : eventId);
  };

  const handleLoadRegistrations = async (eventId: string) => {
    setRegistrationLoading(current => new Set(current).add(eventId));
    try {
      await loadEventRegistrations(eventId);
    } finally {
      setRegistrationLoading(current => {
        const next = new Set(current);
        next.delete(eventId);
        return next;
      });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="min-h-[100dvh] bg-[#f4f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col gap-5 border-b border-[#dbe3ee] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7188a2]"><span className="h-1.5 w-1.5 rounded-full bg-[#557ead]" /> Dispatch desk <span className="text-[#bdc8d5]">/</span> Events</div>
            <h1 data-testid="text-page-title" className="text-3xl font-bold tracking-[-0.04em] text-[#20334d] sm:text-[34px]">Schedule events</h1>
            <p data-testid="text-page-subtitle" className="mt-2 max-w-xl text-sm leading-6 text-[#6e8198]">Coordinate limited-capacity simulation runs, keep manifests current, and give every operator a clear next move.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button data-testid="button-refresh-events" variant="outline" size="icon" onClick={() => loadEvents()} disabled={eventsLoading} aria-label="Refresh events" title="Refresh events">
              <RefreshCw size={15} className={eventsLoading ? 'animate-spin' : ''} />
            </Button>
            <Button data-testid="button-new-event" onClick={openCreate} disabled={!routes.length} className="h-10 gap-2 bg-[#314f78] px-4 shadow-[0_5px_14px_rgba(49,79,120,0.2)] hover:bg-[#284467]"><Plus size={16} strokeWidth={2.5} /> New event</Button>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Scheduled', value: stats.total, detail: 'all event records', icon: CalendarClock, color: 'text-[#4d6f98]', test: 'scheduled' },
            { label: 'Open now', value: stats.active, detail: 'accepting registrations', icon: ShieldCheck, color: 'text-emerald-600', test: 'active' },
            { label: 'On manifests', value: stats.registered, detail: 'registered drivers', icon: Users, color: 'text-[#b07a21]', test: 'registered' },
            { label: 'Places open', value: stats.openPlaces, detail: 'across all events', icon: TrainFront, color: 'text-[#7a65a8]', test: 'open-places' },
          ].map(stat => {
            const Icon = stat.icon;
            return <div data-testid={`stat-event-${stat.test}`} key={stat.label} className="rounded-xl border border-[#dbe3ee] bg-card px-4 py-4 shadow-[0_1px_2px_rgba(34,55,82,0.03)]"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8193a8]">{stat.label}</span><Icon size={16} className={stat.color} /></div><p className="mt-2 font-mono text-2xl font-bold tracking-tight text-[#273d59]">{stat.value}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{stat.detail}</p></div>;
          })}
        </div>

        {error && !events.length ? (
          <div data-testid="status-events-error" className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
            <CircleAlert size={26} className="mx-auto mb-3 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">Events could not be loaded</h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-amber-800/75">{error}</p>
            <Button data-testid="button-retry-events" variant="outline" size="sm" className="mt-4 gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" onClick={() => loadEvents()}><RefreshCw size={13} /> Retry</Button>
          </div>
        ) : eventsLoading && !events.length ? (
          <EventSkeleton />
        ) : !events.length ? (
          <div data-testid="empty-events" className="rounded-2xl border border-dashed border-[#c7d5e5] bg-card px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f0f8] text-[#557ead]"><CalendarClock size={23} /></div>
            <h2 className="text-base font-semibold text-[#304966]">No events on the board</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Schedule the first simulation run to open a registration window and start a manifest.</p>
            <Button data-testid="button-empty-new-event" className="mt-5 gap-2 bg-[#314f78] hover:bg-[#284467]" onClick={openCreate} disabled={!routes.length}><Plus size={15} /> Schedule an event</Button>
            {!routes.length && <p className="mt-3 text-xs text-amber-700">Create a route before scheduling an event.</p>}
          </div>
        ) : (
          <>
            {error && <div data-testid="status-events-refresh-error" className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle size={14} /> {error}</div>}
            <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8093aa]">Event board <span className="font-mono">· {events.length}</span></p><span className="text-xs text-[#8193a8]">Sorted by dispatch priority</span></div>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {orderedEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    routeName={getRouteName(event.routeId, routes)}
                    registrations={eventRegistrations[event.id]}
                    expanded={expandedEventId === event.id}
                    registrationsLoading={registrationLoading.has(event.id)}
                    onToggle={() => toggleRegistrations(event.id)}
                    onEdit={() => openEdit(event)}
                    onDelete={() => deleteEvent(event.id)}
                    onLoadRegistrations={() => handleLoadRegistrations(event.id)}
                    onRegister={data => registerForEvent(event.id, data).then(() => undefined)}
                    onRemoveRegistration={removeEventRegistration}
                  />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-event-form" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="border-b border-border/70 pb-4">
            <DialogTitle className="flex items-center gap-2 text-[#263e5d]"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f0f8] text-[#5279a3]"><CalendarClock size={16} /></div>{editingEvent ? 'Edit scheduled event' : 'Schedule a new event'}</DialogTitle>
            <DialogDescription>{editingEvent ? 'Update the event brief and its registration window.' : 'Set the brief, consist, and capacity before opening the registration window.'}</DialogDescription>
          </DialogHeader>
          <EventForm key={editingEvent?.id || 'new'} event={editingEvent} routeOptions={routes} submitting={submitting} onSubmit={handleSubmit} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}