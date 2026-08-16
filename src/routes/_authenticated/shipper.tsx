import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, PackagePlus, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/Stat";
import { useSession } from "@/hooks/use-session";
import { CITIES, CITY_NAMES, formatINR, roadKm } from "@/lib/geo";
import { fairRate } from "@/lib/matching";

export const Route = createFileRoute("/_authenticated/shipper")({
  head: () => ({
    meta: [
      { title: "Shipper dashboard — post loads, match returning trucks" },
      {
        name: "description",
        content:
          "Post a load, see trucks that are about to run empty near your pickup point, and confirm booking requests.",
      },
      { property: "og:title", content: "Shipper dashboard — TruckLoad AI" },
      {
        property: "og:description",
        content: "Post loads and match with trucks already heading your way.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShipperDashboard,
});

type CityName = keyof typeof CITIES;

function ShipperDashboard() {
  const { profile } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["shipper", profile?.id],
    queryFn: async () => {
      const { data: shipper } = await supabase
        .from("shippers")
        .select("*")
        .eq("user_id", profile!.id)
        .maybeSingle();
      const [{ data: loads }, { data: bookings }, { data: trucks }] = await Promise.all([
        supabase.from("loads").select("*").order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("*, loads(pickup_location, delivery_location), drivers(name, trust_score), trucks(registration_number, truck_type)")
          .order("created_at", { ascending: false }),
        supabase.from("trucks").select("*"),
      ]);
      return { shipper, loads: loads ?? [], bookings: bookings ?? [], trucks: trucks ?? [] };
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    const channel = supabase
      .channel("shipper-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["shipper"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const myLoads = data?.loads.filter((l) => l.shipper_id === data.shipper?.id) ?? [];
  const requests = data?.bookings.filter((b) => b.status === "REQUESTED") ?? [];

  const decide = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const booking = data!.bookings.find((b) => b.id === id)!;
      const { error } = await supabase
        .from("bookings")
        .update({ status: accept ? "CONFIRMED" : "CANCELLED" })
        .eq("id", id);
      if (error) throw error;
      if (accept) {
        await supabase.from("loads").update({ status: "BOOKED" }).eq("id", booking.load_id!);
        await supabase.from("trips").insert({
          truck_id: booking.truck_id,
          booking_id: booking.id,
          start_location:
            (booking.loads as { pickup_location: string } | null)?.pickup_location ?? null,
          destination:
            (booking.loads as { delivery_location: string } | null)?.delivery_location ?? null,
          status: "BOOKED",
          progress: 0,
        });
      }
    },
    onSuccess: () => {
      toast.success("Booking updated");
      void queryClient.invalidateQueries();
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  if (isLoading) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Building2 className="size-6 text-primary" />
          {data?.shipper?.company_name ?? "Shipper workspace"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Post loads and match with trucks that are already heading your way.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active loads" value={myLoads.filter((l) => l.status === "POSTED").length} />
        <Stat label="Booking requests" value={requests.length} tone="warning" />
        <Stat
          label="Confirmed"
          value={data?.bookings.filter((b) => b.status === "CONFIRMED").length ?? 0}
          tone="primary"
        />
        <Stat label="Trucks tracked" value={data?.trucks.length ?? 0} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Matched trucks</TabsTrigger>
          <TabsTrigger value="loads">My loads</TabsTrigger>
          <TabsTrigger value="post">Post load</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 space-y-3">
          {requests.length === 0 ? (
            <Empty text="No booking requests yet. Post a load to start matching." />
          ) : (
            requests.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge className="bg-warning text-warning-foreground">NEW TRUCK MATCHED</Badge>
                    <h3 className="mt-2 text-lg font-semibold">
                      {(b.loads as { pickup_location: string } | null)?.pickup_location} →{" "}
                      {(b.loads as { delivery_location: string } | null)?.delivery_location}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {(b.trucks as { registration_number: string } | null)?.registration_number} ·{" "}
                      {(b.trucks as { truck_type: string } | null)?.truck_type} ·{" "}
                      {(b.drivers as { name: string } | null)?.name} · trust{" "}
                      {(b.drivers as { trust_score: number } | null)?.trust_score}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Return-load booking — avoids an estimated{" "}
                      {Math.round(Number(b.empty_km_avoided ?? 0))} empty km.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{formatINR(Number(b.agreed_rate))}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => decide.mutate({ id: b.id, accept: true })}
                    disabled={decide.isPending}
                  >
                    Accept booking
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => decide.mutate({ id: b.id, accept: false })}
                    disabled={decide.isPending}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="loads" className="mt-4 space-y-3">
          {myLoads.length === 0 ? (
            <Empty text="You haven't posted a load yet." />
          ) : (
            myLoads.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    {l.pickup_location} → {l.delivery_location}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {l.weight} Ton · {l.cargo_type} · {l.truck_type}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatINR(Number(l.budget))}</span>
                  <Badge variant="outline">{l.status}</Badge>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="post" className="mt-4">
          <PostLoadForm
            shipperId={data?.shipper?.id ?? null}
            onPosted={() => void queryClient.invalidateQueries()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
      {text}
    </div>
  );
}

function PostLoadForm({
  shipperId,
  onPosted,
}: {
  shipperId: string | null;
  onPosted: () => void;
}) {
  const [pickup, setPickup] = useState<CityName>("Jabalpur");
  const [delivery, setDelivery] = useState<CityName>("Indore");
  const [weight, setWeight] = useState("8");
  const [cargo, setCargo] = useState("FMCG");
  const [truckType, setTruckType] = useState("10-Wheeler");
  const [budget, setBudget] = useState("24000");
  const [pickupTime, setPickupTime] = useState("");
  const [saving, setSaving] = useState(false);

  const km = roadKm(CITIES[pickup], CITIES[delivery]);
  const fr = fairRate(km, Number(weight) || 8);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shipperId) {
      toast.error("Only shipper accounts can post loads.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("loads").insert({
      shipper_id: shipperId,
      pickup_location: pickup,
      pickup_lat: CITIES[pickup].lat,
      pickup_lng: CITIES[pickup].lng,
      delivery_location: delivery,
      delivery_lat: CITIES[delivery].lat,
      delivery_lng: CITIES[delivery].lng,
      weight: Number(weight),
      cargo_type: cargo,
      truck_type: truckType,
      budget: Number(budget),
      pickup_time: pickupTime ? new Date(pickupTime).toISOString() : new Date().toISOString(),
      status: "POSTED",
    });
    setSaving(false);
    if (error) {
      toast.error("Could not post the load. Please try again.");
      return;
    }
    toast.success("Load posted — matching trucks now");
    onPosted();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
      <CitySelect id="pickup" label="Pickup" value={pickup} onChange={setPickup} />
      <CitySelect id="delivery" label="Delivery" value={delivery} onChange={setDelivery} />
      <div className="space-y-2">
        <Label htmlFor="cargo">Cargo type</Label>
        <Input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="weight">Weight (tonnes)</Label>
        <Input
          id="weight"
          type="number"
          min={1}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tt">Truck type</Label>
        <Select value={truckType} onValueChange={setTruckType}>
          <SelectTrigger id="tt">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["6-Wheeler", "10-Wheeler", "12-Wheeler"].map((tt) => (
              <SelectItem key={tt} value={tt}>
                {tt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pt">Pickup date & time</Label>
        <Input
          id="pt"
          type="datetime-local"
          value={pickupTime}
          onChange={(e) => setPickupTime(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="budget">Budget (₹)</Label>
        <Input
          id="budget"
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          required
        />
      </div>
      <div className="rounded-lg border border-border bg-background p-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Estimated platform rate · {km} km
        </p>
        <p className="mt-1 font-semibold">
          {formatINR(fr.low)} – {formatINR(fr.high)}
        </p>
        <p className="text-xs text-muted-foreground">Suggested {formatINR(fr.suggested)}</p>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
          Post load
        </Button>
      </div>
    </form>
  );
}

function CitySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: CityName;
  onChange: (v: CityName) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as CityName)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CITY_NAMES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
