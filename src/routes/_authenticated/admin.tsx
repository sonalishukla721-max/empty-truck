import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatKm } from "@/lib/geo";
import { IMPACT_ASSUMPTIONS } from "@/lib/matching";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Operations console — network, matches and pilot validation" },
      {
        name: "description",
        content:
          "Operations view of trucks, loads, bookings, match rate and pilot-corridor validation metrics.",
      },
      { property: "og:title", content: "Operations console — TruckLoad AI" },
      {
        property: "og:description",
        content: "Network health, empty-truck zones and pilot validation tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [{ data: trucks }, { data: loads }, { data: bookings }, { data: drivers }, { data: pilot }] =
        await Promise.all([
          supabase.from("trucks").select("*"),
          supabase.from("loads").select("*"),
          supabase.from("bookings").select("*"),
          supabase.from("drivers").select("*"),
          supabase.from("pilot_validation").select("*"),
        ]);
      return {
        trucks: trucks ?? [],
        loads: loads ?? [],
        bookings: bookings ?? [],
        drivers: drivers ?? [],
        pilot: pilot ?? [],
      };
    },
  });

  if (isLoading) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;
  if (!data) return null;

  const matched = data.loads.filter((l) => l.status !== "POSTED").length;
  const gmv = data.bookings.reduce((s, b) => s + Number(b.agreed_rate ?? 0), 0);
  const emptyKm = data.bookings.reduce((s, b) => s + Number(b.empty_km_avoided ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Operations console</h1>
        <Badge variant="outline" className="text-warning">
          SEEDED DEMO DATA
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Trucks" value={data.trucks.length} />
        <Stat
          label="Empty soon"
          value={data.trucks.filter((t) => t.status === "EMPTY_SOON").length}
          tone="warning"
        />
        <Stat label="Loads posted" value={data.loads.length} />
        <Stat label="Loads matched" value={matched} tone="primary" />
        <Stat
          label="Booking conversion"
          value={`${data.loads.length ? Math.round((data.bookings.length / data.loads.length) * 100) : 0}%`}
        />
        <Stat label="GMV" value={formatINR(gmv)} hint="Demo + pilot" />
        <Stat label="Platform revenue (2%)" value={formatINR(gmv * 0.02)} hint="Illustrative" />
        <Stat
          label="Empty KM avoided"
          value={formatKm(emptyKm)}
          hint={`~${Math.round(emptyKm * IMPACT_ASSUMPTIONS.fuelPerKm)} L fuel estimated`}
        />
      </div>

      <Tabs defaultValue="trucks">
        <TabsList>
          <TabsTrigger value="trucks">Trucks</TabsTrigger>
          <TabsTrigger value="loads">Loads</TabsTrigger>
          <TabsTrigger value="drivers">Drivers & KYC</TabsTrigger>
          <TabsTrigger value="pilot">Pilot validation</TabsTrigger>
        </TabsList>

        <TabsContent value="trucks" className="mt-4">
          <DataTable
            head={["Registration", "Type", "Capacity", "Destination", "Status"]}
            rows={data.trucks.map((t) => [
              t.registration_number,
              t.truck_type,
              `${Number(t.capacity)} T`,
              t.destination_city ?? "—",
              t.status,
            ])}
          />
        </TabsContent>

        <TabsContent value="loads" className="mt-4">
          <DataTable
            head={["Route", "Cargo", "Weight", "Budget", "Status"]}
            rows={data.loads.map((l) => [
              `${l.pickup_location} → ${l.delivery_location}`,
              l.cargo_type,
              `${Number(l.weight)} T`,
              formatINR(Number(l.budget)),
              l.status,
            ])}
          />
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <DataTable
            head={["Driver", "Trips", "Return loads", "Trust", "KYC"]}
            rows={data.drivers.map((d) => [
              d.name,
              String(d.completed_trips),
              String(d.return_loads_found),
              String(d.trust_score),
              d.kyc_status,
            ])}
          />
        </TabsContent>

        <TabsContent value="pilot" className="mt-4">
          <DataTable
            head={["Metric", "Value", "Notes"]}
            rows={data.pilot.map((p) => [
              p.metric.replaceAll("_", " "),
              String(Number(p.value)),
              p.notes ?? "—",
            ])}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Pilot numbers are tracked manually from interviews in the Jabalpur corridor. They are not
            extrapolated to national figures.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={head.length} className="text-center text-muted-foreground">
                No records yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => (
                  <TableCell key={j} className="capitalize">
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
