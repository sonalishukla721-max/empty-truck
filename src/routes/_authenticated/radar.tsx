import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RadarMap, type RadarPoint } from "@/components/RadarMap";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatKm, haversineKm, CITIES } from "@/lib/geo";
import { IMPACT_ASSUMPTIONS } from "@/lib/matching";

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Return Load Radar — empty trucks and nearby loads" },
      {
        name: "description",
        content:
          "Live corridor view of trucks becoming empty, available return loads and empty-truck hotspots across the Jabalpur pilot corridor.",
      },
      { property: "og:title", content: "Return Load Radar — TruckLoad AI" },
      {
        property: "og:description",
        content: "See empty-soon trucks, nearby loads and potential matches on one radar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RadarPage,
});

function RadarPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["radar"],
    queryFn: async () => {
      const [{ data: trucks }, { data: loads }] = await Promise.all([
        supabase.from("trucks").select("*"),
        supabase.from("loads").select("*").eq("status", "POSTED"),
      ]);
      return { trucks: trucks ?? [], loads: loads ?? [] };
    },
  });

  const points: RadarPoint[] = useMemo(() => {
    if (!data) return [];
    const truckPoints = data.trucks.map<RadarPoint>((t) => ({
      id: `truck-${t.id}`,
      lat: Number(t.current_lat ?? 0),
      lng: Number(t.current_lng ?? 0),
      label: `${t.registration_number} · ${t.status}`,
      kind: t.status === "EMPTY_SOON" ? "empty_soon" : "truck",
    }));
    const loadPoints = data.loads.map<RadarPoint>((l) => ({
      id: `load-${l.id}`,
      lat: Number(l.pickup_lat),
      lng: Number(l.pickup_lng),
      label: `${l.pickup_location} → ${l.delivery_location} · ${formatINR(Number(l.budget))}`,
      kind: "load",
    }));
    const hotspot: RadarPoint = {
      id: "hotspot-jabalpur",
      lat: CITIES.Jabalpur.lat + 0.35,
      lng: CITIES.Jabalpur.lng - 0.35,
      label: "Jabalpur — high empty-truck zone",
      kind: "hotspot",
    };
    return [...loadPoints, ...truckPoints, hotspot];
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const emptySoon = data.trucks.filter((t) => t.status === "EMPTY_SOON");
    const nearJabalpur = data.loads.filter(
      (l) => haversineKm(CITIES.Jabalpur, { lat: Number(l.pickup_lat), lng: Number(l.pickup_lng) }) <= 50,
    );
    const revenue = nearJabalpur.reduce((s, l) => s + Number(l.budget), 0);
    const emptyKm = nearJabalpur.length * 620;
    return {
      emptySoon: emptySoon.length,
      loadsNear: nearJabalpur.length,
      matches: Math.min(emptySoon.length, nearJabalpur.length) + nearJabalpur.length,
      revenue,
      emptyKm,
      fuel: Math.round(emptyKm * IMPACT_ASSUMPTIONS.fuelPerKm),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Return Load Radar</h1>
          <p className="text-sm text-muted-foreground">
            Pilot corridor: Jabalpur → Indore → Bhopal → Nagpur
          </p>
        </div>
        <Badge variant="outline" className="text-warning">
          ESTIMATED / DEMO VALUES
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {isLoading ? (
          <div className="aspect-[4/3] animate-pulse rounded-xl border border-border bg-card" />
        ) : (
          <RadarMap points={points} selectedId={selected} onSelect={setSelected} />
        )}

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">JABALPUR</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats?.emptySoon ?? 0} tracked trucks expected to become empty in this corridor.
            </p>
            <p className="text-sm text-muted-foreground">
              {stats?.loadsNear ?? 0} loads available within 50 km.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Potential matches" value={stats?.matches ?? 0} tone="primary" />
            <Stat label="Revenue unlocked" value={formatINR(stats?.revenue ?? 0)} hint="Estimated" />
            <Stat label="Empty KM avoidable" value={formatKm(stats?.emptyKm ?? 0)} hint="Estimated" />
            <Stat label="Fuel avoidable" value={`~${stats?.fuel ?? 0} L`} hint="Estimated" />
          </div>
        </div>
      </div>
    </div>
  );
}
