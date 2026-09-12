import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';

import { MstsProvider } from '@/store/msts-store';
import { Shell } from '@/components/layout/Shell';
import { Routes } from '@/pages/Routes';
import { RouteDetail } from '@/pages/RouteDetail';
import { Models } from '@/pages/Models';
import { ManageRoutes } from '@/pages/ManageRoutes';
import { ScheduleEvents } from '@/pages/ScheduleEvents';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/">
          <Redirect to="/routes" />
        </Route>
        <Route path="/routes" component={Routes} />
        <Route path="/routes/:routeId" component={RouteDetail} />
        <Route path="/models" component={Models} />
        <Route path="/manage-routes" component={ManageRoutes} />
        <Route path="/schedule-events" component={ScheduleEvents} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MstsProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </MstsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
