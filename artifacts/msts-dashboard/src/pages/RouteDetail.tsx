import { useState, useRef, useEffect } from 'react';
import { useMsts, Buyer } from '@/store/msts-store';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Upload, UserPlus, Search, FileSpreadsheet, Layers, Users,
  CheckCircle2, Trash2, Mail, MessageCircle, FolderOpen, Loader2, Eye, Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';

export function RouteDetail() {
  const { routeId } = useParams();
  const { routes, buyers, buyersLoading, loadBuyers, addBuyer, addBuyers, updateBuyerStatus, deleteBuyer, previewEmail, sendEmails } = useMsts();
  const { toast } = useToast();

  const route = routes.find(r => r.id === routeId);

  // Load buyers for this route on mount
  useEffect(() => {
    if (routeId) loadBuyers(routeId);
  }, [routeId, loadBuyers]);

  const [search, setSearch] = useState('');
  const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add buyer form
  const [bName, setBName] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bAddress, setBAddress] = useState('');
  const [bVersion, setBVersion] = useState(route?.versions[0]?.id || '');
  const [bFare, setBFare] = useState(route?.defaultFare ? String(route.defaultFare) : '');
  const [bStatus, setBStatus] = useState<'active' | 'inactive'>('active');
  const [bJoinDate, setBJoinDate] = useState(new Date().toISOString().split('T')[0]);

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importVersion, setImportVersion] = useState(route?.versions[0]?.id || '');
  const [isDragOver, setIsDragOver] = useState(false);
  const [sendEmailFlags, setSendEmailFlags] = useState<Record<number, boolean>>({});   // index → send?
  const [existingRowIndices, setExistingRowIndices] = useState<Record<number, boolean>>({});  // index → already in system?

  // Email preview
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewBuyerId, setPreviewBuyerId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingEmails, setSendingEmails] = useState<string[]>([]);   // buyer IDs being sent

  if (!route) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-center">
        <h2 className="text-xl font-semibold">Route not found</h2>
        <Link href="/routes" className="text-primary hover:underline mt-3 text-sm">Back to Routes</Link>
      </div>
    );
  }

  const filteredBuyers = buyers.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.phone.includes(search) ||
    (b.email || '').toLowerCase().includes(search.toLowerCase()),
  );
  const activeBuyers = buyers.filter(b => b.status === 'active').length;

  // ── Add buyer ────────────────────────────────────────────────────────────────

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName || !bPhone || !bVersion || !bFare) return;
    try {
      setSubmitting(true);
      await addBuyer(route.id, {
        routeVersionId: bVersion,
        name: bName,
        email: bEmail || null,
        phone: bPhone,
        address: bAddress,
        fareAmount: Number(bFare),
        status: bStatus,
        joinDate: bJoinDate,
      });
      toast({ title: 'Buyer added', description: `${bName} has been registered.` });
      setIsAddBuyerOpen(false);
      setBName(''); setBEmail(''); setBPhone(''); setBAddress(''); setBFare('');
      setBJoinDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── CSV import ───────────────────────────────────────────────────────────────

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        setParsedRows(rows);

        // Build a set of existing buyer emails (lowercase) to detect duplicates
        const existingEmails = new Set(
          buyers.map(b => b.email?.toLowerCase()).filter(Boolean)
        );

        const flags: Record<number, boolean> = {};
        const existing: Record<number, boolean> = {};
        rows.forEach((row, i) => {
          const email = (row.Email || row.email || '').trim().toLowerCase();
          const isDuplicate = !!email && existingEmails.has(email);
          existing[i] = isDuplicate;
          flags[i] = !isDuplicate; // only pre-check new buyers
        });
        setSendEmailFlags(flags);
        setExistingRowIndices(existing);
      },
      error: (error) => toast({ title: 'Error parsing CSV', description: error.message, variant: 'destructive' }),
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) parseFile(file);
    else toast({ title: 'Invalid file', description: 'Please drop a .csv file.', variant: 'destructive' });
  };

  const confirmImport = async () => {
    if (!parsedRows.length) return;
    try {
      setSubmitting(true);

      // Only import rows that are NOT already in the system
      const newRows = parsedRows
        .map((row, i) => ({ row, i }))
        .filter(({ i }) => !existingRowIndices[i]);

      const skipped = parsedRows.length - newRows.length;

      if (!newRows.length) {
        toast({ title: 'Nothing to import', description: 'All rows in this CSV are already in the system.', variant: 'destructive' });
        return;
      }

      const newBuyersData = newRows.map(({ row }) => ({
        routeVersionId: importVersion,
        name: row.Name || row.name || 'Unknown',
        email: row.Email || row.email || null,
        phone: row.Phone || row.phone || '',
        address: row.Address || row.address || '',
        fareAmount: Number(row.Fare || row.fare || row.FareAmount || 0),
        status: (row.Status || row.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
        notes: 'Imported via CSV',
      }));

      const created = await addBuyers(route.id, newBuyersData);

      // Send emails only to newly created buyers whose checkbox is checked
      const toEmail = created.filter((_, idx) => {
        const origIndex = newRows[idx].i;
        return sendEmailFlags[origIndex] && newBuyersData[idx].email;
      });

      if (toEmail.length > 0) {
        toast({ title: 'Sending welcome emails…', description: `Sending to ${toEmail.length} buyer${toEmail.length > 1 ? 's' : ''}` });
        try {
          const results = await sendEmails(route.id, toEmail.map(b => b.id));
          const sent = results.filter(r => r.status === 'sent').length;
          const failed = results.filter(r => r.status === 'failed').length;
          toast({
            title: 'Emails sent',
            description: `${sent} sent${failed > 0 ? `, ${failed} failed` : ''}.`,
          });
        } catch {
          toast({ title: 'Some emails failed', description: 'Buyers were imported but emails could not be sent.', variant: 'destructive' });
        }
      }

      toast({
        title: 'Import complete',
        description: `${created.length} new buyer${created.length !== 1 ? 's' : ''} added${skipped > 0 ? `, ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped` : ''}.`,
      });
      setIsImportOpen(false);
      setParsedRows([]);
      setExistingRowIndices({});
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Status toggle ────────────────────────────────────────────────────────────

  const handleMakeActive = async (id: string) => {
    try {
      await updateBuyerStatus(id, 'active');
      toast({ title: 'Buyer activated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBuyer(id);
      setDeleteTarget(null);
      toast({ title: 'Buyer removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Email preview & send ─────────────────────────────────────────────────────

  const handlePreviewEmail = async (buyerId: string) => {
    if (!routeId) return;
    try {
      setPreviewLoading(true);
      setPreviewBuyerId(buyerId);
      const preview = await previewEmail(routeId, buyerId);
      setEmailPreview(preview);
    } catch (err: any) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
      setPreviewBuyerId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendEmail = async (buyerId: string) => {
    if (!routeId) return;
    try {
      setSendingEmails(prev => [...prev, buyerId]);
      const results = await sendEmails(routeId, [buyerId]);
      const result = results[0];
      if (result?.status === 'sent') {
        toast({ title: 'Email sent!', description: 'Welcome email delivered successfully.' });
      } else {
        toast({ title: 'Send failed', description: result?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSendingEmails(prev => prev.filter(id => id !== buyerId));
      setEmailPreview(null);
      setPreviewBuyerId(null);
    }
  };

  return (
    <motion.div
      className="p-8 max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Back */}
      <Link href="/routes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={14} />
        Back to Routes
      </Link>

      {/* Route Header */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold font-mono text-sm">{route.code.split('-')[0]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{route.name}</h1>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{route.code}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {route.versions.map(v => (
                  <Badge key={v.id} variant="secondary" className="text-xs font-normal gap-1.5">
                    <Layers size={10} />
                    {v.label} — {v.description}
                  </Badge>
                ))}
              </div>
              {/* Resource links */}
              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                {route.whatsappGroupLink && (
                  <a
                    href={route.whatsappGroupLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-full transition-colors border border-green-200"
                    onClick={e => e.stopPropagation()}
                  >
                    <MessageCircle size={11} />
                    WhatsApp Group
                  </a>
                )}
                {route.driveFolderLink && (
                  <a
                    href={route.driveFolderLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition-colors border border-blue-200"
                    onClick={e => e.stopPropagation()}
                  >
                    <FolderOpen size={11} />
                    Drive Folder
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center px-4 py-2 rounded-xl bg-muted/60">
              <div className="text-xl font-bold text-foreground">{activeBuyers}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-muted/60">
              <div className="text-xl font-bold text-foreground">{buyers.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Add Buyer */}
        <Dialog open={isAddBuyerOpen} onOpenChange={setIsAddBuyerOpen}>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-5 bg-primary text-primary-foreground rounded-xl cursor-pointer shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
                <UserPlus size={18} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Add Route Buyers</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">Register a buyer manually</p>
              </div>
            </motion.button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Register New Buyer</DialogTitle></DialogHeader>
            <form onSubmit={handleAddBuyer} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bName">Full Name</Label>
                  <Input id="bName" placeholder="Rahul Sharma" value={bName} onChange={e => setBName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bPhone">Phone</Label>
                  <Input id="bPhone" placeholder="+91 98765 43210" value={bPhone} onChange={e => setBPhone(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bEmail" className="flex items-center gap-1.5">
                  <Mail size={12} className="text-muted-foreground" />
                  Email <span className="text-muted-foreground font-normal text-xs">(for welcome email)</span>
                </Label>
                <Input id="bEmail" type="email" placeholder="rahul@example.com" value={bEmail} onChange={e => setBEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bAddress">Address</Label>
                <Input id="bAddress" placeholder="Andheri West, Mumbai" value={bAddress} onChange={e => setBAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Route Version</Label>
                  <Select value={bVersion} onValueChange={setBVersion}>
                    <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                    <SelectContent>
                      {route.versions.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.label} — {v.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bFare">Fare Amount (₹)</Label>
                  <Input id="bFare" type="number" placeholder="1200" value={bFare} onChange={e => setBFare(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={bStatus} onValueChange={(v: any) => setBStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bJoinDate">Join Date</Label>
                  <Input id="bJoinDate" type="date" value={bJoinDate} onChange={e => setBJoinDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setIsAddBuyerOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  Save Buyer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Import CSV */}
        <Dialog open={isImportOpen} onOpenChange={open => { setIsImportOpen(open); if (!open) setParsedRows([]); }}>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-5 bg-card border border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Upload size={18} className="text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground">Add CSV</p>
                <p className="text-xs text-muted-foreground mt-0.5">Import buyers from spreadsheet</p>
              </div>
            </motion.button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader><DialogTitle>Import Buyers via CSV</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/30'}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-muted-foreground/40'}`} />
                <p className="text-sm font-medium">Drop your CSV file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Columns: Name, Email, Phone, Address, Fare, Status</p>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileInput} />
              </div>

              <AnimatePresence>
                {parsedRows.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-sm font-medium">{parsedRows.length} rows found</span>
                        {Object.values(existingRowIndices).filter(Boolean).length > 0 && (
                          <span className="text-amber-600 font-normal text-xs">
                            · {Object.values(existingRowIndices).filter(Boolean).length} already added — will be skipped
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Version:</Label>
                        <Select value={importVersion} onValueChange={setImportVersion}>
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Select version" /></SelectTrigger>
                          <SelectContent>
                            {route.versions.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Preview table with email checkboxes */}
                    <div className="border border-border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="text-xs w-8">
                              <Checkbox
                                checked={parsedRows.every((_, i) => sendEmailFlags[i])}
                                onCheckedChange={checked => {
                                  const flags: Record<number, boolean> = {};
                                  parsedRows.forEach((_, i) => { flags[i] = !!checked; });
                                  setSendEmailFlags(flags);
                                }}
                              />
                            </TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs">Phone</TableHead>
                            <TableHead className="text-xs">Fare</TableHead>
                            <TableHead className="text-xs">
                              <span className="flex items-center gap-1"><Mail size={11} /> Send email?</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedRows.slice(0, 6).map((row, i) => {
                            const isExisting = existingRowIndices[i];
                            return (
                              <TableRow key={i} className={isExisting ? 'opacity-40 bg-muted/30' : sendEmailFlags[i] ? '' : 'opacity-50'}>
                                <TableCell className="py-2">
                                  <Checkbox
                                    checked={!isExisting && !!sendEmailFlags[i]}
                                    disabled={isExisting}
                                    onCheckedChange={checked => !isExisting && setSendEmailFlags(prev => ({ ...prev, [i]: !!checked }))}
                                  />
                                </TableCell>
                                <TableCell className="text-xs py-2 font-medium">{row.Name || row.name}</TableCell>
                                <TableCell className="text-xs py-2 text-muted-foreground">{row.Email || row.email || '—'}</TableCell>
                                <TableCell className="text-xs py-2 text-muted-foreground">{row.Phone || row.phone}</TableCell>
                                <TableCell className="text-xs py-2">₹{row.Fare || row.fare}</TableCell>
                                <TableCell className="text-xs py-2">
                                  {isExisting
                                    ? <span className="text-amber-600 font-medium text-xs">Already added</span>
                                    : sendEmailFlags[i]
                                      ? <span className="text-emerald-600 font-medium">✓ Send</span>
                                      : <span className="text-muted-foreground">Skip</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {parsedRows.length > 6 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-2 bg-muted/20">
                                +{parsedRows.length - 6} more rows (all apply the same email rule)
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Mail size={11} />
                      Checked rows will receive a Grok-generated welcome email after import (only if they have an email address).
                    </p>

                    <Button className="w-full gap-2" onClick={confirmImport} disabled={submitting}>
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      Confirm Import ({parsedRows.length} buyers)
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buyers Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Buyers</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{buyers.length}</span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, phone or email…"
              className="pl-8 h-8 text-sm bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {buyersLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading buyers…</span>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-xs font-semibold">Buyer</TableHead>
                <TableHead className="text-xs font-semibold">Version</TableHead>
                <TableHead className="text-xs font-semibold">Address</TableHead>
                <TableHead className="text-xs font-semibold">Joined</TableHead>
                <TableHead className="text-xs font-semibold text-right">Fare</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredBuyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Users size={24} className="opacity-30" />
                        <p className="text-sm">No buyers yet. Add one above.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBuyers.map(buyer => {
                    const version = route.versions.find(v => v.id === buyer.routeVersionId);
                    const isSending = sendingEmails.includes(buyer.id);

                    return (
                      <TableRow key={buyer.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div className="font-medium text-sm text-foreground">{buyer.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{buyer.phone}</div>
                          {buyer.email && (
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Mail size={10} />
                              {buyer.email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono font-normal">
                            {version?.label || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {buyer.address || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {buyer.joinDate || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-foreground">
                          ₹{buyer.fareAmount}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              className={buyer.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs'
                                : 'bg-muted text-muted-foreground text-xs'}
                              variant="outline"
                            >
                              {buyer.status}
                            </Badge>
                            {buyer.emailSent && (
                              <span className="text-[10px] text-blue-500 flex items-center gap-1">
                                <Mail size={9} /> emailed
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {buyer.status !== 'active' && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                                onClick={() => handleMakeActive(buyer.id)}
                              >
                                <CheckCircle2 size={12} />
                                Make Active
                              </Button>
                            )}
                            {/* Email button — preview if not sent, "Send Again" if already sent */}
                            {buyer.email && (
                              <Button
                                variant="ghost" size="sm"
                                className={`h-7 text-xs gap-1 ${buyer.emailSent
                                  ? 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'
                                  : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                                onClick={() => handlePreviewEmail(buyer.id)}
                                disabled={isSending || (previewLoading && previewBuyerId === buyer.id)}
                              >
                                {isSending || (previewLoading && previewBuyerId === buyer.id)
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : buyer.emailSent ? <Send size={12} /> : <Eye size={12} />}
                                {buyer.emailSent ? 'Send Again' : 'Email'}
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                              onClick={() => setDeleteTarget(buyer.id)}
                            >
                              <Trash2 size={12} />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete buyer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the buyer from this route. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email preview dialog */}
      <Dialog open={!!emailPreview} onOpenChange={open => { if (!open) { setEmailPreview(null); setPreviewBuyerId(null); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={16} className="text-blue-500" />
              Welcome Email Preview
            </DialogTitle>
          </DialogHeader>
          {emailPreview && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg px-4 py-2.5 text-sm">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Subject: </span>
                <span className="font-medium">{emailPreview.subject}</span>
              </div>
              <div
                className="border border-border rounded-xl p-5 text-sm leading-relaxed max-h-80 overflow-y-auto prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: emailPreview.html }}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {route.driveFolderLink
                  ? <>Sending will also share the Drive folder with the buyer's email via Google Drive API.</>
                  : <>This route has no Drive folder linked — email only.</>}
              </p>
              <div className="flex justify-end gap-2 pt-1 border-t">
                <Button variant="outline" onClick={() => { setEmailPreview(null); setPreviewBuyerId(null); }}>
                  Cancel
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => previewBuyerId && handleSendEmail(previewBuyerId)}
                  disabled={sendingEmails.includes(previewBuyerId || '')}
                >
                  {sendingEmails.includes(previewBuyerId || '')
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />}
                  Send Email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
