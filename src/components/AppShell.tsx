import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Radar,
  Package,
  BarChart3,
  ShieldCheck,
  LogOut,
  Building2,
  Bell,
  Check,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications", profile.id] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read: true }).eq("user_id", profile?.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

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
            {profile && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="size-5" />
                    {unreadCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex size-2.5 rounded-full bg-destructive" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between border-b border-border p-3">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs"
                        onClick={() => markAllAsRead.mutate()}
                      >
                        <Check className="mr-1 size-3" /> Mark all read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "rounded-md p-3 text-sm transition-colors",
                            !n.read ? "bg-primary/5" : "hover:bg-accent"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <p className={cn("font-medium", !n.read && "text-primary")}>{n.title}</p>
                            {!n.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0"
                                onClick={() => markAsRead.mutate(n.id)}
                              >
                                <Check className="size-3" />
                              </Button>
                            )}
                          </div>
                          {n.body && <p className="mt-1 text-muted-foreground text-xs">{n.body}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
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
