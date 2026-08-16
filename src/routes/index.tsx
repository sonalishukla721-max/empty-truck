import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Truck,
  Radar,
  Gauge,
  Leaf,
  IndianRupee,
  Package,
  Route as RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/geo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TruckLoad AI — Don't let your truck return empty" },
      {
        name: "description",
        content:
          "TruckLoad AI predicts when a truck becomes empty and matches it with a return load nearby — more driver income, fewer empty kilometres.",
      },
      { property: "og:title", content: "TruckLoad AI — turn empty trucks into paid trips" },
      {
        property: "og:description",
        content:
          "AI-assisted return-load matching for Indian trucking. Predict, match, book, track, measure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Package className="size-4" />
            </span>
            TruckLoad <span className="text-primary">AI</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm">
                <Link to="/driver">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="surface-grid relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_60%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
            <div>
              <Badge variant="outline" className="text-primary">
                Don't let your truck return empty
              </Badge>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-6xl">
                <span className="text-gradient-primary">TURN EMPTY TRUCKS INTO PAID TRIPS.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                TruckLoad AI matches trucks with return loads <em>before</em> they travel empty. We
                predict the empty leg, rank nearby loads deterministically, and hand the driver a
                booking — not a search box.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    Find a return load <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth">Post a load</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Pilot corridor: Jabalpur → Indore → Bhopal → Nagpur. Demo data is clearly labelled.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Live product loop
              </p>
              <ol className="mt-4 space-y-3">
                {[
                  { city: "Mumbai", note: "Loaded trip starts", tone: "muted" },
                  { city: "Jabalpur", note: "Truck becomes EMPTY SOON", tone: "warning" },
                  { city: "Indore", note: "Return load matched · 94%", tone: "primary" },
                ].map((s, i) => (
                  <li key={s.city} className="flex items-start gap-3">
                    <span
                      className={
                        "mt-1 size-2.5 shrink-0 rounded-full " +
                        (s.tone === "primary"
                          ? "bg-primary"
                          : s.tone === "warning"
                            ? "bg-warning"
                            : "bg-muted-foreground")
                      }
                    />
                    <div>
                      <p className="font-medium">
                        {i + 1}. {s.city}
                      </p>
                      <p className="text-sm text-muted-foreground">{s.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5 text-sm">
                <MiniStat icon={<IndianRupee className="size-4" />} label="Extra income" value={formatINR(24000)} />
                <MiniStat icon={<Truck className="size-4" />} label="Empty km avoided" value="1,040 km" />
                <MiniStat icon={<Gauge className="size-4" />} label="Fuel saved" value="~156 L" />
                <MiniStat icon={<Leaf className="size-4" />} label="CO₂ avoided" value="~366 kg" />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Illustrative estimates from the demo corridor, not measured field data.
              </p>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="max-w-3xl text-3xl font-semibold sm:text-4xl">
              India's trucks don't just carry goods. They also carry empty kilometres.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="text-sm uppercase tracking-wide text-muted-foreground">Loaded trip</p>
                <p className="mt-2 text-5xl font-semibold text-primary">100%</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cargo delivered, driver paid, fuel productive.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="text-sm uppercase tracking-wide text-muted-foreground">Return trip</p>
                <p className="mt-2 text-5xl font-semibold text-destructive">EMPTY</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Same fuel, same driver hours, zero revenue. Share of return trips running empty:
                  [VALIDATED STATISTIC — pending pilot data].
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LOOP */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-3xl font-semibold sm:text-4xl">Predict → Match → Book → Track → Measure</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Feature
                icon={<Gauge className="size-5" />}
                title="Predictive empty engine"
                body="From the active trip and ETA we compute when and where the truck becomes empty, then search a configurable radius around that point."
              />
              <Feature
                icon={<Radar className="size-5" />}
                title="Return Load Radar"
                body="Corridor view of empty-soon trucks, available loads and empty-truck hotspots — the operational picture nobody else shows."
              />
              <Feature
                icon={<RouteIcon className="size-5" />}
                title="Deterministic matching"
                body="30% route, 25% distance, 20% capacity, 10% timing, 10% price, 5% trust. AI explains the match; it never invents the score."
              />
            </div>
          </div>
        </section>

        {/* DIFFERENTIATOR */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-3xl font-semibold sm:text-4xl">NOT ANOTHER TRUCK MARKETPLACE.</h2>
            <div className="mt-10 overflow-hidden rounded-xl border border-border">
              {[
                ["Find me a truck.", "Find me a return load for this truck."],
                ["Reactive", "Predictive"],
                ["Truck discovery", "Truck + route + timing + return-load intelligence"],
                ["Transaction focused", "Utilization focused"],
              ].map(([a, b]) => (
                <div key={a} className="grid gap-2 border-b border-border last:border-0 sm:grid-cols-2">
                  <div className="bg-card p-5 text-muted-foreground">{a}</div>
                  <div className="bg-accent p-5 font-medium">{b}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">Your next trip starts before this one ends.</h2>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth">
              Start the demo journey <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        TruckLoad AI · Pilot MVP · All impact figures are estimates from configurable assumptions.
      </footer>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <span className="grid size-10 place-items-center rounded-lg bg-accent text-primary">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
