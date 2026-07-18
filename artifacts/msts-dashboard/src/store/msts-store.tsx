import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface RouteVersion {
  id: string;
  label: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface Route {
  id: string;
  name: string;
  code: string;
  versions: RouteVersion[];
}

export interface Buyer {
  id: string;
  routeId: string;
  routeVersionId: string;
  name: string;
  phone: string;
  address: string;
  fareAmount: number;
  status: "active" | "inactive";
  joinDate: string;
  notes: string;
}

interface MstsState {
  routes: Route[];
  buyers: Buyer[];
}

type Action =
  | { type: 'ADD_ROUTE'; payload: Route }
  | { type: 'ADD_ROUTE_VERSION'; payload: { routeId: string; version: RouteVersion } }
  | { type: 'ADD_BUYER'; payload: Buyer }
  | { type: 'ADD_BUYERS'; payload: Buyer[] }
  | { type: 'UPDATE_BUYER_STATUS'; payload: { id: string; status: "active" | "inactive" } }
  | { type: 'DELETE_BUYER'; payload: string };

const seedRoutes: Route[] = [
  {
    id: "r1",
    name: "Andheri - Dadar Fast",
    code: "AD-01",
    versions: [
      { id: "v1-1", label: "v1", description: "Morning Express", isActive: true, createdAt: "2023-01-10T00:00:00Z" },
      { id: "v1-2", label: "v1.1", description: "Evening Fast", isActive: true, createdAt: "2023-03-15T00:00:00Z" }
    ]
  },
  {
    id: "r2",
    name: "Borivali - CST Express",
    code: "BC-01",
    versions: [
      { id: "v2-1", label: "v1", description: "Regular daily", isActive: true, createdAt: "2023-02-01T00:00:00Z" }
    ]
  },
  {
    id: "r3",
    name: "Thane - Vashi Link",
    code: "TV-01",
    versions: [
      { id: "v3-1", label: "v1", description: "Weekday only", isActive: true, createdAt: "2023-04-20T00:00:00Z" },
      { id: "v3-2", label: "v2", description: "Weekend special", isActive: true, createdAt: "2023-06-10T00:00:00Z" }
    ]
  }
];

const seedBuyers: Buyer[] = [
  { id: "b1", routeId: "r1", routeVersionId: "v1-1", name: "Rahul Sharma", phone: "+91 98765 43210", address: "Andheri West, Mumbai", fareAmount: 1200, status: "active", joinDate: "2023-05-01", notes: "Prefers window seat" },
  { id: "b2", routeId: "r1", routeVersionId: "v1-1", name: "Priya Patel", phone: "+91 98765 43211", address: "Vile Parle, Mumbai", fareAmount: 1200, status: "active", joinDate: "2023-05-03", notes: "" },
  { id: "b3", routeId: "r1", routeVersionId: "v1-2", name: "Amit Singh", phone: "+91 98765 43212", address: "Dadar East, Mumbai", fareAmount: 1500, status: "inactive", joinDate: "2023-06-12", notes: "Suspended temp" },
  { id: "b4", routeId: "r2", routeVersionId: "v2-1", name: "Sneha Desai", phone: "+91 98765 43213", address: "Borivali West, Mumbai", fareAmount: 2000, status: "active", joinDate: "2023-02-15", notes: "" },
  { id: "b5", routeId: "r2", routeVersionId: "v2-1", name: "Vikram Reddy", phone: "+91 98765 43214", address: "Kandivali, Mumbai", fareAmount: 2000, status: "active", joinDate: "2023-03-20", notes: "" },
  { id: "b6", routeId: "r3", routeVersionId: "v3-1", name: "Anita Kadam", phone: "+91 98765 43215", address: "Thane West, Thane", fareAmount: 800, status: "active", joinDate: "2023-05-10", notes: "" },
  { id: "b7", routeId: "r3", routeVersionId: "v3-2", name: "Suresh Pillai", phone: "+91 98765 43216", address: "Airoli, Navi Mumbai", fareAmount: 950, status: "active", joinDate: "2023-06-25", notes: "" },
  { id: "b8", routeId: "r3", routeVersionId: "v3-1", name: "Neha Gupta", phone: "+91 98765 43217", address: "Vashi Sector 17, Navi Mumbai", fareAmount: 800, status: "inactive", joinDate: "2023-05-11", notes: "Changed job" },
];

const initialState: MstsState = {
  routes: seedRoutes,
  buyers: seedBuyers,
};

function mstsReducer(state: MstsState, action: Action): MstsState {
  switch (action.type) {
    case 'ADD_ROUTE':
      return { ...state, routes: [...state.routes, action.payload] };
    case 'ADD_ROUTE_VERSION':
      return {
        ...state,
        routes: state.routes.map(r => 
          r.id === action.payload.routeId 
            ? { ...r, versions: [...r.versions, action.payload.version] } 
            : r
        )
      };
    case 'ADD_BUYER':
      return { ...state, buyers: [...state.buyers, action.payload] };
    case 'ADD_BUYERS':
      return { ...state, buyers: [...state.buyers, ...action.payload] };
    case 'UPDATE_BUYER_STATUS':
      return {
        ...state,
        buyers: state.buyers.map(b => 
          b.id === action.payload.id ? { ...b, status: action.payload.status } : b
        )
      };
    case 'DELETE_BUYER':
      return {
        ...state,
        buyers: state.buyers.filter(b => b.id !== action.payload)
      };
    default:
      return state;
  }
}

const MstsContext = createContext<{
  state: MstsState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => null });

export function MstsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mstsReducer, initialState);

  return (
    <MstsContext.Provider value={{ state, dispatch }}>
      {children}
    </MstsContext.Provider>
  );
}

export function useMsts() {
  return useContext(MstsContext);
}
