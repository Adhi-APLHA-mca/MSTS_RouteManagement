import { useState } from "react";
import { useMsts } from "@/store/msts-store";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, ChevronRight, Users, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 28 } }
};

export function Routes() {
  const { state, dispatch } = useMsts();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [versionDesc, setVersionDesc] = useState("Default version");

  const filteredRoutes = state.routes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !versionLabel) return;

    const newRoute = {
      id: `r${Date.now()}`,
      name,
      code,
      versions: [{
        id: `v${Date.now()}`,
        label: versionLabel,
        description: versionDesc,
        isActive: true,
        createdAt: new Date().toISOString()
      }]
    };

    dispatch({ type: 'ADD_ROUTE', payload: newRoute });
    toast({ title: "Route created", description: `${name} has been added.` });
    setIsAddModalOpen(false);
    setName(""); setCode(""); setVersionLabel("v1"); setVersionDesc("Default version");
  };

  return (
    <motion.div
      className="p-8 max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Routes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {state.routes.length} route{state.routes.length !== 1 ? 's' : ''} in your network
          </p>
        </div>

        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md shadow-primary/20">
              <Plus size={15} strokeWidth={2.5} />
              Add Route
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">Create New Route</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddRoute} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Route Name</Label>
                <Input id="name" placeholder="e.g. Andheri - Dadar Fast" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-sm font-medium">Route Code</Label>
                <Input id="code" placeholder="e.g. AD-01" value={code} onChange={e => setCode(e.target.value)} required className="font-mono" />
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Initial Version</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vLabel" className="text-sm font-medium">Version Label</Label>
                    <Input id="vLabel" value={versionLabel} onChange={e => setVersionLabel(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vDesc" className="text-sm font-medium">Description</Label>
                    <Input id="vDesc" placeholder="e.g. Morning Express" value={versionDesc} onChange={e => setVersionDesc(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                <Button type="submit">Create Route</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or code..."
          className="pl-9 max-w-sm bg-card h-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <AnimatePresence mode="wait">
        {filteredRoutes.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed bg-card/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">No routes found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or add a new route.</p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="space-y-2.5"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {filteredRoutes.map(route => {
              const totalBuyers = state.buyers.filter(b => b.routeId === route.id).length;
              const activeBuyers = state.buyers.filter(b => b.routeId === route.id && b.status === "active").length;

              return (
                <motion.div key={route.id} variants={itemVariants}>
                  <Link href={`/routes/${route.id}`}>
                    <div className="group bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover-lift hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-4">
                        {/* Code badge */}
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-xs font-mono">{route.code.split('-')[0]}</span>
                        </div>

                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                            {route.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {route.code}
                            </span>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Layers size={11} />
                              {route.versions.length} version{route.versions.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users size={13} />
                          <span className="font-medium text-foreground">{activeBuyers}</span>
                          <span>/ {totalBuyers} buyers</span>
                        </div>
                        <div className="flex gap-1.5">
                          {route.versions.map(v => (
                            <Badge key={v.id} variant="secondary" className="text-[10px] px-2 py-0.5 font-mono">
                              {v.label}
                            </Badge>
                          ))}
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
