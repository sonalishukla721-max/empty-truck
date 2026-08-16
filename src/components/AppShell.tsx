import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Radar,
  Package,
  BarChart3,
  ShieldCheck,
  LogOut,
  Building2,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/use-session";

const NAV = [
  { to: "/driver", label: "Driver", icon: Truck, roles: ["DRIVER", "ADMIN"] },
  { to: "/radar", label: "Radar", icon: Radar, roles: ["DRIVER", "SHIPPER", "ADMIN"] },
  { to: "/shipper", label: "Shipper", icon: Building2, roles: ["SHIPPER", "ADMIN"] },
  { to: "/impact", label: "Impact", icon: BarChart3, roles: ["DRIVER", "SHIPPER", "ADMIN"] },
  { to: "/admin", label: "Admin", icon: ShieldCheck, roles: ["ADMIN"] },
] as const;

export function AppShell({
  profile,
  children,
}: {
  profile: Profile | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = profile?.role ?? "DRIVER";
  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(role));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Package className="size-4" />
            </span>
            <span>
              TruckLoad <span className="text-primary">AI</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  pathname === item.to && "bg-accent text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.name ?? "Account"} · {role}
            </span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur md:hidden">
        {items.slice(0, 4).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground",
              pathname === item.to && "text-primary",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
