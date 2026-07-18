import { useState, useRef } from "react";
import { useMsts, Buyer } from "@/store/msts-store";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, UserPlus, Search, FileSpreadsheet, Layers, Users, CheckCircle2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";

export function RouteDetail() {
  const { routeId } = useParams();
  const { state, dispatch } = useMsts();
  const { toast } = useToast();

  const route = state.routes.find(r => r.id === routeId);
  const routeBuyers = state.buyers.filter(b => b.routeId === routeId);

  const [search, setSearch] = useState("");
  const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Add buyer form
  const [bName, setBName] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [bVersion, setBVersion] = useState(route?.versions[0]?.id || "");
  const [bFare, setBFare] = useState("");
  const [bStatus, setBStatus] = useState<"active" | "inactive">("active");

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importVersion, setImportVersion] = useState(route?.versions[0]?.id || "");
  const [isDragOver, setIsDragOver] = useState(false);

  if (!route) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-center">
        <h2 className="text-xl font-semibold">Route not found</h2>
        <Link href="/routes" className="text-primary hover:underline mt-3 text-sm">Back to Routes</Link>
      </div>
    );
  }

  const filteredBuyers = routeBuyers.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.phone.includes(search)
  );

  const handleAddBuyer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName || !bPhone || !bVersion || !bFare) return;

    const newBuyer: Buyer = {
      id: `b${Date.now()}`,
      routeId: route.id,
      routeVersionId: bVersion,
      name: bName,
      phone: bPhone,
      address: bAddress,
      fareAmount: Number(bFare),
      status: bStatus,
      joinDate: new Date().toISOString().split('T')[0],
      notes: ""
    };

    dispatch({ type: 'ADD_BUYER', payload: newBuyer });
    toast({ title: "Buyer added", description: `${bName} has been registered.` });
    setIsAddBuyerOpen(false);
    setBName(""); setBPhone(""); setBAddress(""); setBFare("");
  };

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setParsedRows(results.data as any[]),
      error: (error) => toast({ title: "Error parsing CSV", description: error.message, variant: "destructive" })
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
    else toast({ title: "Invalid file", description: "Please drop a .csv file.", variant: "destructive" });
  };

  const confirmImport = () => {
    if (!parsedRows.length) return;
    const newBuyers: Buyer[] = parsedRows.map((row, idx) => ({
      id: `b_imp_${Date.now()}_${idx}`,
      routeId: route.id,
      routeVersionId: importVersion,
      name: row.Name || row.name || "Unknown",
      phone: row.Phone || row.phone || "Unknown",
      address: row.Address || row.address || "",
      fareAmount: Number(row.Fare || row.fare || row.FareAmount || 0),
      status: (row.Status || row.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
      joinDate: new Date().toISOString().split('T')[0],
      notes: "Imported via CSV"
    }));
    dispatch({ type: 'ADD_BUYERS', payload: newBuyers });
    toast({ title: "Import complete", description: `${newBuyers.length} buyers added successfully.` });
    setIsImportOpen(false);
    setParsedRows([]);
  };

  const handleMakeActive = (id: string) => {
    dispatch({ type: 'UPDATE_BUYER_STATUS', payload: { id, status: "active" } });
    toast({ title: "Buyer activated", description: "Buyer status set to active." });
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_BUYER', payload: id });
    setDeleteTarget(null);
    toast({ title: "Buyer removed", description: "Buyer has been deleted." });
  };

  const activeBuyers = routeBuyers.filter(b => b.status === "active").length;

  return (
    <motion.div
      className="p-8 max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Back */}
      <Link href="/routes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={14} />
        Back to Routes
      </Link>

      {/* Route Header */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
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
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 rounded-xl bg-muted/60">
              <div className="text-xl font-bold text-foreground">{activeBuyers}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-muted/60">
              <div className="text-xl font-bold text-foreground">{routeBuyers.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Add Buyer */}
        <Dialog open={isAddBuyerOpen} onOpenChange={setIsAddBuyerOpen}>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
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
            <DialogHeader>
              <DialogTitle>Register New Buyer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddBuyer} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bName">Full Name</Label>
                  <Input id="bName" placeholder="e.g. Rahul Sharma" value={bName} onChange={e => setBName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bPhone">Phone</Label>
                  <Input id="bPhone" placeholder="+91 98765 43210" value={bPhone} onChange={e => setBPhone(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bAddress">Address</Label>
                <Input id="bAddress" placeholder="e.g. Andheri West, Mumbai" value={bAddress} onChange={e => setBAddress(e.target.value)} />
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
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setIsAddBuyerOpen(false)}>Cancel</Button>
                <Button type="submit">Save Buyer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Import CSV */}
        <Dialog open={isImportOpen} onOpenChange={(open) => { setIsImportOpen(open); if (!open) setParsedRows([]); }}>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
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
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Buyers via CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/30'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-muted-foreground/40'}`} />
                <p className="text-sm font-medium">Drop your CSV file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Columns: Name, Phone, Address, Fare, Status</p>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileInput} />
              </div>

              <AnimatePresence>
                {parsedRows.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-sm font-medium">{parsedRows.length} rows found</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Version:</Label>
                        <Select value={importVersion} onValueChange={setImportVersion}>
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            {route.versions.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Phone</TableHead>
                            <TableHead className="text-xs">Fare</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedRows.slice(0, 4).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs py-2">{row.Name || row.name}</TableCell>
                              <TableCell className="text-xs py-2">{row.Phone || row.phone}</TableCell>
                              <TableCell className="text-xs py-2">₹{row.Fare || row.fare}</TableCell>
                            </TableRow>
                          ))}
                          {parsedRows.length > 4 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-2 bg-muted/20">
                                +{parsedRows.length - 4} more rows
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <Button className="w-full gap-2" onClick={confirmImport}>
                      <Upload size={14} />
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
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{routeBuyers.length}</span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name or phone..."
              className="pl-8 h-8 text-sm bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-xs font-semibold">Buyer</TableHead>
              <TableHead className="text-xs font-semibold">Version</TableHead>
              <TableHead className="text-xs font-semibold">Address</TableHead>
              <TableHead className="text-xs font-semibold text-right">Fare</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {filteredBuyers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Users size={24} className="opacity-30" />
                      <p className="text-sm">No buyers yet. Add one above.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBuyers.map(buyer => {
                  const version = route.versions.find(v => v.id === buyer.routeVersionId);
                  return (
                    <TableRow key={buyer.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="font-medium text-sm text-foreground">{buyer.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{buyer.phone}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono font-normal">
                          {version?.label || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {buyer.address || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground">
                        ₹{buyer.fareAmount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={buyer.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs"
                            : "bg-muted text-muted-foreground text-xs"}
                          variant="outline"
                        >
                          {buyer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {buyer.status !== "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                              onClick={() => handleMakeActive(buyer.id)}
                            >
                              <CheckCircle2 size={12} />
                              Make Active
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
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
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
