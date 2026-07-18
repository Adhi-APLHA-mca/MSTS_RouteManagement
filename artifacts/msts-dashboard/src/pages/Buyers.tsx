import { useState } from "react";
import { useMsts } from "@/store/msts-store";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

export function Buyers() {
  const { state, dispatch } = useMsts();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredBuyers = state.buyers.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.phone.includes(search);
    const matchesRoute = routeFilter === "all" || b.routeId === routeFilter;
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesRoute && matchesStatus;
  });

  const handleExport = () => {
    if (filteredBuyers.length === 0) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }

    const exportData = filteredBuyers.map(b => {
      const route = state.routes.find(r => r.id === b.routeId);
      const version = route?.versions.find(v => v.id === b.routeVersionId);
      return {
        Name: b.name,
        Phone: b.phone,
        Address: b.address,
        RouteName: route?.name || "Unknown",
        RouteCode: route?.code || "Unknown",
        RouteVersion: version?.label || "Unknown",
        Fare: b.fareAmount,
        Status: b.status,
        JoinDate: b.joinDate
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `buyers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export complete", description: "CSV file downloaded successfully." });
  };

  const toggleStatus = (id: string, currentStatus: "active" | "inactive") => {
    dispatch({ 
      type: 'UPDATE_BUYER_STATUS', 
      payload: { id, status: currentStatus === "active" ? "inactive" : "active" } 
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Global Buyer Directory</h1>
          <p className="text-muted-foreground mt-1">View and manage all registered commuters across every route.</p>
        </div>
        <Button variant="outline" className="gap-2 bg-white" onClick={handleExport}>
          <Download size={16} />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search buyers by name or phone..." 
            className="pl-9 bg-background/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={routeFilter} onValueChange={setRouteFilter}>
            <SelectTrigger className="w-[180px] bg-background/50">
              <SelectValue placeholder="All Routes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              {state.routes.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.code} - {r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-background/50">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Buyer Info</TableHead>
              <TableHead>Route & Version</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="text-right">Fare</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBuyers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Search className="h-8 w-8 mb-2 opacity-50" />
                    <p>No buyers match your filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredBuyers.map(buyer => {
                const route = state.routes.find(r => r.id === buyer.routeId);
                const version = route?.versions.find(v => v.id === buyer.routeVersionId);
                
                return (
                  <TableRow key={buyer.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="font-medium text-foreground">{buyer.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{buyer.phone}</div>
                    </TableCell>
                    <TableCell>
                      {route ? (
                        <div className="flex flex-col items-start gap-1">
                          <Link href={`/routes/${route.id}`} className="text-sm font-medium hover:text-primary hover:underline transition-colors">
                            {route.name}
                          </Link>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">{route.code}</span>
                            <Badge variant="outline" className="h-5 text-[10px] px-1.5 font-normal bg-background">
                              {version?.label || "Unk"}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unknown Route</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(buyer.joinDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{buyer.fareAmount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={buyer.status === "active" ? "default" : "secondary"} 
                             className={buyer.status === "active" ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-200" : ""}>
                        {buyer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs h-8"
                        onClick={() => toggleStatus(buyer.id, buyer.status)}
                      >
                        Toggle
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-xs text-muted-foreground text-center">
        Showing {filteredBuyers.length} of {state.buyers.length} total buyers
      </div>
    </div>
  );
}
