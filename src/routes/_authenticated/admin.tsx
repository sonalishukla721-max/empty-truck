import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

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
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [
        { data: trucks },
        { data: loads },
        { data: bookings },
        { data: drivers },
        { data: shippers },
        { data: trips },
        { data: pilot },
      ] = await Promise.all([
        supabase.from("trucks").select("*"),
        supabase.from("loads").select("*"),
        supabase.from("bookings").select("*, loads(*), drivers(*), trucks(*)"),
        supabase.from("drivers").select("*").order("created_at", { ascending: false }),
        supabase.from("shippers").select("*").order("created_at", { ascending: false }),
        supabase.from("trips").select("*"),
        supabase.from("pilot_validation").select("*"),
      ]);
      return {
        trucks: trucks ?? [],
        loads: loads ?? [],
        bookings: bookings ?? [],
        drivers: drivers ?? [],
        shippers: shippers ?? [],
        trips: trips ?? [],
        pilot: pilot ?? [],
      };
    },
  });

  const verifyDriver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").update({ kyc_status: "VERIFIED" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Driver verified");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: any) => toast.error(e?.message || "Verification failed"),
  });

  const verifyShipper = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shippers").update({ verification_status: "VERIFIED" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shipper verified");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: any) => toast.error(e?.message || "Verification failed"),
  });

  if (isLoading) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;
  if (!data) return null;

  const matched = data.loads.filter((l) => l.status !== "POSTED").length;
  const gmv = data.bookings.reduce((s, b) => s + Number(b.agreed_rate ?? 0), 0);
  const emptyKm = data.bookings.reduce((s, b) => s + Number(b.empty_km_avoided ?? 0), 0);
  const completedTrips = data.trips.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Operations console</h1>
          <p className="text-sm text-muted-foreground">
            Live platform metrics, corridor network health & pilot validation.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Trucks" value={data.trucks.length} />
        <Stat
          label="Empty soon"
          value={data.trucks.filter((t) => t.status === "EMPTY_SOON").length}
          tone="warning"
        />
        <Stat label="Loads Posted" value={data.loads.length} />
        <Stat label="Loads Matched" value={matched} tone="primary" />
        <Stat
          label="Total Drivers"
          value={data.drivers.length}
        />
        <Stat
          label="Total Shippers"
          value={data.shippers.length}
        />
        <Stat label="Completed Trips" value={completedTrips} tone="primary" />
        <Stat
          label="Gross Booking Value"
          value={formatINR(gmv)}
          hint="Calculated across all return loads"
        />
        <Stat label="Platform Revenue (2%)" value={formatINR(gmv * 0.02)} hint="Platform fee" />
        <Stat
          label="Empty KM Avoided"
          value={formatKm(emptyKm)}
          hint={`~${Math.round(emptyKm * IMPACT_ASSUMPTIONS.fuelPerKm)} L fuel saved`}
        />
        <Stat
          label="Est. CO₂ Avoided"
          value={`~${Math.round(emptyKm * IMPACT_ASSUMPTIONS.fuelPerKm * IMPACT_ASSUMPTIONS.co2PerLitre)} kg`}
          hint="Carbon emissions avoided"
        />
        <Stat
          label="Match Rate"
          value={`${data.loads.length ? Math.round((matched / data.loads.length) * 100) : 0}%`}
          tone="primary"
        />
      </div>

      <Tabs defaultValue="trucks">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto flex-wrap">
          <TabsTrigger value="trucks" className="py-2">Trucks ({data.trucks.length})</TabsTrigger>
          <TabsTrigger value="loads" className="py-2">Loads ({data.loads.length})</TabsTrigger>
          <TabsTrigger value="bookings" className="py-2">Bookings ({data.bookings.length})</TabsTrigger>
          <TabsTrigger value="trips" className="py-2">Trips ({data.trips.length})</TabsTrigger>
          <TabsTrigger value="drivers" className="py-2">Drivers ({data.drivers.length})</TabsTrigger>
          <TabsTrigger value="shippers" className="py-2">Shippers ({data.shippers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="trucks" className="mt-4">
          <DataTable
            head={["Registration", "Type", "Capacity", "Current / Destination", "Status"]}
            rows={data.trucks.map((t) => [
              t.registration_number,
              t.truck_type,
              `${Number(t.capacity)} T`,
              `${t.current_city || "—"} → ${t.destination_city ?? "—"}`,
              <Badge variant={t.status === "AVAILABLE" ? "default" : "outline"} key={t.id}>{t.status}</Badge>,
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
              <Badge variant={l.status === "POSTED" ? "default" : "outline"} key={l.id}>{l.status}</Badge>,
            ])}
          />
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          <DataTable
            head={["Load Route", "Truck", "Agreed Rate", "Status", "Empty KM Avoided"]}
            rows={data.bookings.map((b) => [
              `${(b.loads as any)?.pickup_location || "—"} → ${(b.loads as any)?.delivery_location || "—"}`,
              (b.trucks as any)?.registration_number || "—",
              formatINR(Number(b.agreed_rate ?? 0)),
              b.status,
              `${Math.round(Number(b.empty_km_avoided ?? 0))} km`,
            ])}
          />
        </TabsContent>

        <TabsContent value="trips" className="mt-4">
          <DataTable
            head={["Route", "Progress", "Status"]}
            rows={data.trips.map((t) => [
              `${t.start_location || "—"} → ${t.destination || "—"}`,
              `${t.progress || 0}%`,
              t.status,
            ])}
          />
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <DataTable
            head={["Driver", "Phone", "Trips", "Return Loads", "Trust Score", "KYC", "Action"]}
            rows={data.drivers.map((d) => [
              d.name,
              d.phone || "—",
              String(d.completed_trips),
              String(d.return_loads_found),
              `${d.trust_score} ⭐`,
              <Badge variant={d.kyc_status === "VERIFIED" ? "default" : "destructive"} key={d.id + "s"}>{d.kyc_status}</Badge>,
              d.kyc_status === "PENDING" ? (
                <Button size="sm" variant="outline" onClick={() => verifyDriver.mutate(d.id)} disabled={verifyDriver.isPending} key={d.id + "b"}>
                  <CheckCircle className="mr-1 size-3" /> Verify
                </Button>
              ) : <span key={d.id + "b"}>—</span>,
            ])}
          />
        </TabsContent>

        <TabsContent value="shippers" className="mt-4">
          <DataTable
            head={["Company Name", "Phone", "Trust Score", "Verification", "Action"]}
            rows={data.shippers.map((s) => [
              s.company_name,
              s.phone || "—",
              `${s.trust_score} ⭐`,
              <Badge variant={s.verification_status === "VERIFIED" ? "default" : "destructive"} key={s.id + "s"}>{s.verification_status}</Badge>,
              s.verification_status === "PENDING" ? (
                <Button size="sm" variant="outline" onClick={() => verifyShipper.mutate(s.id)} disabled={verifyShipper.isPending} key={s.id + "b"}>
                  <CheckCircle className="mr-1 size-3" /> Verify
                </Button>
              ) : <span key={s.id + "b"}>—</span>,
            ])}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h) => (
              <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={head.length} className="text-center text-muted-foreground py-8">
                No records yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => (
                  <TableCell key={j} className="whitespace-nowrap">
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
