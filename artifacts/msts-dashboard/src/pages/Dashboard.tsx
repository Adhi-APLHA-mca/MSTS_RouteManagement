import { useMsts } from "@/store/msts-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Route as RouteIcon, FileSpreadsheet, Activity } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const { state } = useMsts();

  const totalRoutes = state.routes.length;
  const totalBuyers = state.buyers.length;
  const activeBuyers = state.buyers.filter(b => b.status === "active").length;
  
  // Calculate buyers per route
  const routeStats = state.routes.map(route => {
    const buyersCount = state.buyers.filter(b => b.routeId === route.id).length;
    const activeCount = state.buyers.filter(b => b.routeId === route.id && b.status === "active").length;
    return { ...route, buyersCount, activeCount };
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1">Today's snapshot of your transit operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Routes</CardTitle>
            <RouteIcon className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{totalRoutes}</div>
            <p className="text-xs text-muted-foreground mt-1">Active networks managed</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Buyers</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{totalBuyers}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all routes</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-primary">{activeBuyers}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently riding</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Imports</CardTitle>
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">0</div>
            <p className="text-xs text-muted-foreground mt-1">CSV batches this week</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-semibold">Active Routes</h2>
          <Link href="/routes" className="text-sm text-primary hover:underline font-medium">View all</Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routeStats.map(route => (
            <Card key={route.id} className="shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{route.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">{route.code}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {route.versions.length} var{route.versions.length !== 1 && 's'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{route.activeCount} active</span>
                  <span className="text-muted-foreground">/ {route.buyersCount} total</span>
                </div>
              </CardContent>
              <div className="px-6 pb-6 mt-auto">
                <Link href={`/routes/${route.id}`} className="inline-flex items-center justify-between w-full h-10 px-4 py-2 text-sm font-medium transition-colors border rounded-md border-input bg-background hover:bg-accent hover:text-accent-foreground group">
                    Manage Route
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
