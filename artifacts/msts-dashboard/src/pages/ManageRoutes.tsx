import { useEffect, useMemo, useState } from 'react';
import { useMsts } from '@/store/msts-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, UserRoundCog, Check, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export function ManageRoutes() {
  const {
    routes, managedUsers, manageRoutesLoading, loadManageRoutes,
    updateManagedUserStatus, updateManagedUserRoutes,
  } = useMsts();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadManageRoutes(); }, [loadManageRoutes]);

  const visibleUsers = useMemo(() => managedUsers.filter(user =>
    user.username.toLowerCase().includes(search.toLowerCase()),
  ), [managedUsers, search]);

  const selectedFor = (userId: string, current: string[]) => selectedRoutes[userId] ?? current;
  const toggleRoute = (userId: string, routeId: string, current: string[]) => {
    const selected = selectedFor(userId, current);
    setSelectedRoutes(prev => ({
      ...prev,
      [userId]: selected.includes(routeId) ? selected.filter(id => id !== routeId) : [...selected, routeId],
    }));
  };

  const saveRoutes = async (userId: string, current: string[]) => {
    try {
      setSaving(userId);
      await updateManagedUserRoutes(userId, selectedFor(userId, current));
      toast({ title: 'Routes saved', description: 'The person’s route associations were updated.' });
    } catch (err: any) {
      toast({ title: 'Could not save routes', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <motion.div className="p-8 max-w-6xl mx-auto" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Routes</h1>
          <p className="text-sm text-muted-foreground mt-1">Assign routes and manage user access status</p>
        </div>
        <div className="w-72 relative">
          <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username…" className="pl-9" />
        </div>
      </div>

      {manageRoutesLoading ? (
        <div className="flex justify-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : visibleUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-20 text-center text-muted-foreground">
          <UserRoundCog className="mx-auto mb-3 opacity-25" size={36} />
          <p className="text-sm font-medium">{managedUsers.length ? 'No matching users' : 'No users found'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleUsers.map(user => {
            const selected = selectedFor(user.id, user.routeIds);
            return (
              <div key={user.id} className="bg-card border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-44">
                    <p className="font-semibold">{user.username || 'Unnamed user'}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">{user.id}</p>
                    <div className="flex gap-2 mt-3">
                      <Select value={user.accountStatus} onValueChange={value => updateManagedUserStatus(user.id, { account: value })}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Account: active</SelectItem>
                          <SelectItem value="blocked">Account: blocked</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={user.deviceStatus} onValueChange={value => updateManagedUserStatus(user.id, { device: value })}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Device: approved</SelectItem>
                          <SelectItem value="blocked">Device: blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Routes associated</p>
                    <div className="flex flex-wrap gap-2">
                      {routes.map(route => {
                        const active = selected.includes(route.id);
                        return (
                          <button key={route.id} onClick={() => toggleRoute(user.id, route.id, user.routeIds)}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-primary/50 text-muted-foreground'}`}>
                            {active && <Check size={12} className="inline mr-1" />}{route.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {selected.map(id => {
                          const route = routes.find(item => item.id === id);
                          return route ? <Badge key={id} variant="secondary" className="text-[11px]">{route.code}</Badge> : null;
                        })}
                        {!selected.length && <span className="text-xs text-muted-foreground">No routes selected</span>}
                      </div>
                      <Button size="sm" className="gap-1.5" onClick={() => saveRoutes(user.id, user.routeIds)} disabled={saving === user.id}>
                        {saving === user.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}