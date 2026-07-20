import { useState } from 'react';
import { useMsts, RouteModel, ModelTask, AdvancePayment } from '@/store/msts-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, ChevronDown, ChevronUp, Trash2, Loader2, Package,
  IndianRupee, CheckCircle2, ListTodo, Wallet, PlusCircle, Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── helpers ───────────────────────────────────────────────────────────────────

function totalAdvance(payments: AdvancePayment[]) {
  return payments.reduce((s, p) => s + p.amount, 0);
}

// ── ModelCard ─────────────────────────────────────────────────────────────────

function ModelCard({ model, routeId }: { model: RouteModel; routeId: string }) {
  const { addModelTask, toggleModelTask, addModelAdvance, deleteModel } = useMsts();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [deletingModel, setDeletingModel] = useState(false);

  const paid = totalAdvance(model.advancePayments || []);
  const pending = model.totalAmount - paid;
  const allTasksDone = model.tasks.length > 0 && model.tasks.every(t => t.done);
  const isDelivered = model.status === 'delivered';

  const handleAddTask = async () => {
    const title = taskInput.trim();
    if (!title) return;
    try {
      setAddingTask(true);
      await addModelTask(model.id, title);
      setTaskInput('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: ModelTask) => {
    try {
      await toggleModelTask(model.id, task.id, !task.done);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceAmount) return;
    try {
      setSavingAdvance(true);
      await addModelAdvance(model.id, Number(advanceAmount), advanceNote);
      toast({ title: 'Payment recorded', description: `₹${Number(advanceAmount).toLocaleString()} added.` });
      setAdvanceOpen(false);
      setAdvanceAmount('');
      setAdvanceNote('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeletingModel(true);
      await deleteModel(model.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setDeletingModel(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`bg-card border rounded-2xl overflow-hidden transition-colors ${isDelivered ? 'border-emerald-300 dark:border-emerald-700' : 'border-border'}`}
    >
      {/* Delivered banner */}
      <AnimatePresence>
        {isDelivered && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-700 px-5 py-2 flex items-center gap-2"
          >
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Order Successful — Model Delivered
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header row */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{model.name}</span>
            {model.productionName && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">{model.productionName}</span>
            )}
            <Badge
              variant="outline"
              className={`text-xs ${isDelivered ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'text-muted-foreground'}`}
            >
              {isDelivered ? 'Delivered' : 'In Progress'}
            </Badge>
          </div>
          {model.ownerName && (
            <p className="text-xs text-muted-foreground mt-0.5">Owner: {model.ownerName}</p>
          )}
          {/* Money summary */}
          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <IndianRupee size={10} className="text-muted-foreground" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold text-foreground">₹{model.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Wallet size={10} className="text-emerald-600" />
              <span className="text-muted-foreground">Paid:</span>
              <span className="font-semibold text-emerald-700">₹{paid.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Pending:</span>
              <span className={`font-semibold ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ₹{pending.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setAdvanceOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PlusCircle size={10} /> Add payment
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={deletingModel}
          >
            {deletingModel ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="text-xs ml-1">{model.tasks.length} task{model.tasks.length !== 1 ? 's' : ''}</span>
          </Button>
        </div>
      </div>

      {/* Tasks panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <ListTodo size={11} />
                Tasks
              </div>

              {/* Task list */}
              {model.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No tasks yet — add one below.</p>
              ) : (
                <div className="space-y-2">
                  {model.tasks.map(task => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={() => handleToggleTask(task)}
                        className="shrink-0"
                      />
                      <span className={`text-sm flex-1 ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                      {task.done && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                    </label>
                  ))}
                </div>
              )}

              {/* Add task input */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="New task…"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 gap-1 shrink-0"
                  onClick={handleAddTask}
                  disabled={addingTask || !taskInput.trim()}
                >
                  {addingTask ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add
                </Button>
              </div>

              {/* Advance payments log */}
              {(model.advancePayments || []).length > 0 && (
                <div className="border-t border-border pt-3 mt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Payment History</p>
                  <div className="space-y-1.5">
                    {(model.advancePayments || []).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {p.note && <span className="ml-1 text-muted-foreground/70">— {p.note}</span>}
                        </span>
                        <span className="font-semibold text-emerald-700">+₹{p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Advance dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet size={15} className="text-primary" /> Add Payment
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAdvance} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="advAmt">Amount (₹)</Label>
              <Input
                id="advAmt"
                type="number"
                placeholder="e.g. 5000"
                value={advanceAmount}
                onChange={e => setAdvanceAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="advNote">Note <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                id="advNote"
                placeholder="e.g. Second instalment"
                value={advanceNote}
                onChange={e => setAdvanceNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t">
              <Button type="button" variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingAdvance} className="gap-2">
                {savingAdvance && <Loader2 size={13} className="animate-spin" />}
                Save Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── ModelSection ──────────────────────────────────────────────────────────────

export function ModelSection({ routeId }: { routeId: string }) {
  const { models, modelsLoading, addModel } = useMsts();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [mName, setMName] = useState('');
  const [mProd, setMProd] = useState('');
  const [mTotal, setMTotal] = useState('');
  const [mAdvance, setMAdvance] = useState('');
  const [mOwner, setMOwner] = useState('');

  const resetForm = () => { setMName(''); setMProd(''); setMTotal(''); setMAdvance(''); setMOwner(''); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mName || !mTotal) return;
    try {
      setSubmitting(true);
      await addModel(routeId, {
        name: mName,
        productionName: mProd,
        totalAmount: Number(mTotal),
        advance: mAdvance ? Number(mAdvance) : 0,
        ownerName: mOwner,
      });
      toast({ title: 'Model created', description: `${mName} added.` });
      setIsCreateOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground">Models</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{models.length}</span>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsCreateOpen(true)}>
          <Plus size={13} strokeWidth={2.5} />
          Model
        </Button>
      </div>

      {/* Model cards */}
      {modelsLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground bg-card border border-border rounded-2xl">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading models…</span>
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center bg-card border border-dashed border-border rounded-2xl">
          <Package size={28} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No models yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Click <strong>+ Model</strong> to track a custom order</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {models.map(m => (
              <ModelCard key={m.id} model={m} routeId={routeId} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Create Model dialog */}
      <Dialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package size={15} className="text-primary" />
              New Model
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="mName">Model Name <span className="text-destructive">*</span></Label>
              <Input id="mName" placeholder="e.g. Konkan Heritage Train Set" value={mName} onChange={e => setMName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mProd">Production Name</Label>
              <Input id="mProd" placeholder="e.g. KCL-HTS-001" value={mProd} onChange={e => setMProd(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mTotal">Total Amount (₹) <span className="text-destructive">*</span></Label>
                <Input id="mTotal" type="number" placeholder="15000" value={mTotal} onChange={e => setMTotal(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mAdv">Advance (₹)</Label>
                <Input id="mAdv" type="number" placeholder="5000" value={mAdvance} onChange={e => setMAdvance(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mOwner">Owner Name</Label>
              <Input id="mOwner" placeholder="e.g. Rajan Patel" value={mOwner} onChange={e => setMOwner(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Create Model
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
