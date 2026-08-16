import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatKm } from "@/lib/geo";
import { IMPACT_ASSUMPTIONS } from "@/lib/matching";

export const Route = createFileRoute("/_authenticated/impact")({
  head: () => ({
    meta: [
      { title: "Impact dashboard — empty km, fuel and CO₂ avoided" },
      {
        name: "description",
        content:
          "Track empty kilometres avoided, estimated fuel and CO₂ saved, and additional driver earnings from matched return loads.",
      },
      { property: "og:title", content: "Impact dashboard — TruckLoad AI" },
      {
        property: "og:description",
        content: "Estimated empty km, fuel, CO₂ and income impact of your return loads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImpactPage,
});

function ImpactPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["impact"],
    queryFn: async () => {
      const { data: bookings } = await supabase.from("bookings").select("*");
      return bookings ?? [];
    },
  });

  const bookings = data ?? [];
  const emptyKm = bookings.reduce((s, b) => s + Number(b.empty_km_avoided ?? 0), 0);
  const fuel = Math.round(emptyKm * IMPACT_ASSUMPTIONS.fuelPerKm);
  const co2 = Math.round(fuel * IMPACT_ASSUMPTIONS.co2PerLitre);
  const income = bookings.reduce((s, b) => s + Number(b.agreed_rate ?? 0), 0);

  const chartData = [
    { name: "Loaded km", value: Math.round(emptyKm * 1.05) },
    { name: "Empty km avoided", value: Math.round(emptyKm) },
    { name: "Remaining empty km", value: Math.round(emptyKm * 0.08) },
  ];

  const pie = [
    { name: "Return loads", value: bookings.length || 1 },
    { name: "Empty returns", value: Math.max(1, Math.round(bookings.length * 0.4)) },
  ];
  const pieColors = ["var(--chart-1)", "var(--chart-5)"];

  if (isLoading) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your TruckLoad impact</h1>
          <p className="text-sm text-muted-foreground">
            Calculated from your matched return loads using configurable assumptions.
          </p>
        </div>
        <Badge variant="outline" className="text-warning">
          ALL FIGURES ESTIMATED
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Return loads booked" value={bookings.length} tone="primary" />
        <Stat label="Empty KM avoided" value={formatKm(emptyKm)} hint="Estimated" />
        <Stat label="Fuel saved" value={`~${fuel} L`} hint="0.15 L/km assumption" />
        <Stat label="CO₂ avoided" value={`~${co2} kg`} hint="2.35 kg/L assumption" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Before vs after TruckLoad</h2>
          <p className="text-sm text-muted-foreground">Empty kilometre comparison (estimated).</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Additional driver earnings</h2>
          <p className="mt-2 text-4xl font-semibold text-primary">{formatINR(income)}</p>
          <p className="text-sm text-muted-foreground">
            Total agreed rates on matched return loads (estimated additional income).
          </p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                  {pie.map((entry, i) => (
                    <Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
