import { Link, useLocation } from "wouter";
import { Route as RouteIcon, Train } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { label: "Routes", href: "/routes", icon: RouteIcon },
  ];

  return (
    <div className="w-60 bg-sidebar text-sidebar-foreground flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <Train size={18} strokeWidth={2.5} className="text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight leading-none">MSTS Ops</span>
          <span className="text-[11px] text-sidebar-foreground/50 mt-0.5 font-medium">Route Manager</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-sidebar-border/40" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/8"
              )}>
                <item.icon size={16} strokeWidth={2} />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-primary -z-10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom badge */}
      <div className="px-4 py-5">
        <div className="rounded-xl bg-sidebar-foreground/5 px-4 py-3 border border-sidebar-border/30">
          <p className="text-[11px] font-semibold text-sidebar-foreground/70">Route Owner Panel</p>
          <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">Manage your network</p>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
