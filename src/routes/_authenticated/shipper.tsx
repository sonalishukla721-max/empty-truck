import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  PackagePlus,
  Building2,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  Sparkles,
  CreditCard,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/Stat";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { PaymentDialog } from "@/components/PaymentDialog";
import { RatingDialog } from "@/components/RatingDialog";
import { useSession } from "@/hooks/use-session";
import { formatINR, formatKm, roadKm, resolveLocation } from "@/lib/geo";
import { fairRate, scoreMatch, type LoadInput, type TruckInput } from "@/lib/matching";

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

function ShipperDashboard() {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const [selectedPaymentBooking, setSelectedPaymentBooking] = useState<{
    id: string;
    rate: number;
  } | null>(null);
  const [ratingDriverInfo, setRatingDriverInfo] = useState<{
    bookingId: string;
    driverUserId: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shipper", profile?.id],
    queryFn: async () => {
      let { data: shipper } = await supabase
        .from("shippers")
        .select("*")
        .eq("user_id", profile!.id)
        .maybeSingle();

      if (!shipper && profile?.id) {
        const { data: newShipper } = await supabase
          .from("shippers")
          .insert({
            user_id: profile.id,
            company_name: profile.name || "My Business Logistics",
            phone: profile.phone || "",
            trust_score: 4.9,
            verification_status: "VERIFIED",
          })
          .select()
          .single();
        shipper = newShipper;
      }

      const [{ data: loads }, { data: bookings }, { data: trucks }, { data: trips }] = await Promise.all([
        supabase.from("loads").select("*").order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("*, loads(*), drivers(*), trucks(*)")
          .order("created_at", { ascending: false }),
        supabase.from("trucks").select("*"),
        supabase.from("trips").select("*, bookings(*), trucks(*)").order("created_at", { ascending: false }),
      ]);
      return {
        shipper,
        loads: loads ?? [],
        bookings: bookings ?? [],
        trucks: trucks ?? [],
        trips: trips ?? [],
      };
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    const channel = supabase
      .channel("shipper-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["shipper"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "loads" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["shipper"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["shipper"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const myLoads = data?.loads.filter((l) => l.shipper_id === data.shipper?.id) ?? [];
  const requests = data?.bookings.filter((b) => b.status === "REQUESTED" && b.shipper_id === data?.shipper?.id) ?? [];
  const activeShipments = data?.trips.filter((t) => t.status !== "COMPLETED") ?? [];

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
          start_location: (booking.loads as any)?.pickup_location ?? "Origin",
          start_lat: (booking.loads as any)?.pickup_lat ?? 23.1815,
          start_lng: (booking.loads as any)?.pickup_lng ?? 79.9864,
          destination: (booking.loads as any)?.delivery_location ?? "Destination",
          destination_lat: (booking.loads as any)?.delivery_lat ?? 22.7196,
          destination_lng: (booking.loads as any)?.delivery_lng ?? 75.8577,
          status: "IN_TRANSIT",
          progress: 10,
        });

        // Insert notification for driver
        if ((booking.drivers as any)?.user_id) {
          await supabase.from("notifications").insert({
            user_id: (booking.drivers as any).user_id,
            title: "Booking Accepted!",
            message: `Shipper accepted your return-load booking for ${(booking.loads as any)?.pickup_location} → ${(booking.loads as any)?.delivery_location}.`,
            type: "BOOKING_ACCEPTED",
          });
        }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="size-6 text-primary" />
            {data?.shipper?.company_name ?? "Shipper workspace"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Post loads and match with trucks that are already heading your way. Trust: {data?.shipper?.trust_score ?? 4.9} ⭐
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active loads" value={myLoads.filter((l) => l.status === "POSTED").length} />
        <Stat label="Booking requests" value={requests.length} tone="warning" />
        <Stat
          label="Active Shipments"
          value={activeShipments.length}
          tone="primary"
        />
        <Stat label="Trucks in Network" value={data?.trucks.length ?? 0} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Booking Requests ({requests.length})</TabsTrigger>
          <TabsTrigger value="loads">My Posted Loads ({myLoads.length})</TabsTrigger>
          <TabsTrigger value="post">Post New Load</TabsTrigger>
          <TabsTrigger value="shipments">Active Shipments ({activeShipments.length})</TabsTrigger>
        </TabsList>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          {requests.length === 0 ? (
            <Empty text="No booking requests yet. Post a load to start matching with empty returning trucks." />
          ) : (
            requests.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge className="bg-warning text-warning-foreground">NEW TRUCK MATCHED</Badge>
                    <h3 className="mt-2 text-lg font-semibold">
                      {(b.loads as any)?.pickup_location} → {(b.loads as any)?.delivery_location}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {(b.trucks as any)?.registration_number} · {(b.trucks as any)?.truck_type} · {(b.drivers as any)?.name} · Trust {(b.drivers as any)?.trust_score ?? 4.8} ⭐
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Return-load booking — avoids an estimated {Math.round(Number(b.empty_km_avoided ?? 0))} empty km.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-primary">{formatINR(Number(b.agreed_rate))}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => decide.mutate({ id: b.id, accept: true })}
                    disabled={decide.isPending}
                    className="gap-1.5"
                  >
                    <CheckCircle className="size-4" /> Accept Booking
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedPaymentBooking({ id: b.id, rate: Number(b.agreed_rate) })}
                    className="gap-1.5"
                  >
                    <CreditCard className="size-4 text-primary" /> Pay Advance Escrow
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

        {/* My Loads Tab */}
        <TabsContent value="loads" className="mt-4 space-y-3">
          {myLoads.length === 0 ? (
            <Empty text="You haven't posted a load yet." />
          ) : (
            myLoads.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium text-base">
                    {l.pickup_location} → {l.delivery_location}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {l.weight} Ton · {l.cargo_type} · {l.truck_type} · Pickup: {new Date(l.pickup_time).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-lg">{formatINR(Number(l.budget))}</span>
                  <Badge variant={l.status === "POSTED" ? "default" : "outline"}>{l.status}</Badge>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Post Load Form */}
        <TabsContent value="post" className="mt-4">
          <PostLoadForm
            shipperId={data?.shipper?.id ?? null}
            onPosted={() => void queryClient.invalidateQueries()}
          />
        </TabsContent>

        {/* Active Shipments Tab */}
        <TabsContent value="shipments" className="mt-4 space-y-3">
          {activeShipments.length === 0 ? (
            <Empty text="No active in-transit shipments currently." />
          ) : (
            activeShipments.map((tp) => (
              <div key={tp.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-primary text-primary-foreground">IN TRANSIT</Badge>
                    <h3 className="mt-1 font-semibold text-lg">
                      {tp.start_location} → {tp.destination}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Vehicle: {(tp.trucks as any)?.registration_number || "Truck"} · Status: {tp.status}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      const driverUserId = (tp.bookings as any)?.driver_id;
                      if (driverUserId) {
                        setRatingDriverInfo({
                          bookingId: tp.booking_id,
                          driverUserId,
                        });
                      }
                    }}
                  >
                    <Award className="size-4 text-primary" /> Rate Driver
                  </Button>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Transit Progress</span>
                    <span>{tp.progress || 10}%</span>
                  </div>
                  <Progress value={Number(tp.progress || 10)} />
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Advance Payment Dialog */}
      {selectedPaymentBooking && (
        <PaymentDialog
          open={!!selectedPaymentBooking}
          onOpenChange={(op) => !op && setSelectedPaymentBooking(null)}
          bookingId={selectedPaymentBooking.id}
          agreedRate={selectedPaymentBooking.rate}
          payerId={profile?.id || ""}
          onSuccess={() => {
            setSelectedPaymentBooking(null);
            void queryClient.invalidateQueries();
          }}
        />
      )}

      {/* Driver Rating Dialog */}
      {ratingDriverInfo && (
        <RatingDialog
          open={!!ratingDriverInfo}
          onOpenChange={(op) => !op && setRatingDriverInfo(null)}
          bookingId={ratingDriverInfo.bookingId}
          fromUserId={profile?.id || ""}
          toUserId={ratingDriverInfo.driverUserId}
          targetRole="DRIVER"
          onSuccess={() => setRatingDriverInfo(null)}
        />
      )}
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
  const [pickupLoc, setPickupLoc] = useState<LocationValue>({
    name: "Jabalpur",
    lat: 23.1815,
    lng: 79.9864,
  });
  const [deliveryLoc, setDeliveryLoc] = useState<LocationValue>({
    name: "Indore",
    lat: 22.7196,
    lng: 75.8577,
  });
  const [weight, setWeight] = useState("8");
  const [cargo, setCargo] = useState("FMCG Goods");
  const [truckType, setTruckType] = useState("10-Wheeler");
  const [budget, setBudget] = useState("24000");
  const [pickupTime, setPickupTime] = useState("");
  const [saving, setSaving] = useState(false);

  const km = roadKm({ lat: pickupLoc.lat, lng: pickupLoc.lng }, { lat: deliveryLoc.lat, lng: deliveryLoc.lng });
  const fr = fairRate(km, Number(weight) || 8);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shipperId) {
      toast.error("Shipper profile not found. Please log in as shipper.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("loads").insert({
      shipper_id: shipperId,
      pickup_location: pickupLoc.name,
      pickup_lat: pickupLoc.lat,
      pickup_lng: pickupLoc.lng,
      delivery_location: deliveryLoc.name,
      delivery_lat: deliveryLoc.lat,
      delivery_lng: deliveryLoc.lng,
      weight: Number(weight),
      cargo_type: cargo,
      truck_type: truckType,
      budget: Number(budget),
      pickup_time: pickupTime ? new Date(pickupTime).toISOString() : new Date().toISOString(),
      status: "POSTED",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not post the load. Please try again.");
      return;
    }
    toast.success("Load posted successfully! Looking for returning trucks...");
    onPosted();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 shadow-sm">
      <LocationPicker
        label="Pickup Location (City / GPS)"
        value={pickupLoc.name}
        onChange={setPickupLoc}
      />
      <LocationPicker
        label="Delivery Location (City / GPS)"
        value={deliveryLoc.name}
        onChange={setDeliveryLoc}
      />

      <div className="space-y-2">
        <Label htmlFor="cargo">Cargo type</Label>
        <Input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="weight">Weight (Tonnes)</Label>
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
        <Label htmlFor="tt">Required Truck Type</Label>
        <Select value={truckType} onValueChange={setTruckType}>
          <SelectTrigger id="tt">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["6-Wheeler", "10-Wheeler", "12-Wheeler", "14-Wheeler", "Trailer"].map((tt) => (
              <SelectItem key={tt} value={tt}>
                {tt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pt">Pickup Date & Time</Label>
        <Input
          id="pt"
          type="datetime-local"
          value={pickupTime}
          onChange={(e) => setPickupTime(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget">Offered Budget (₹)</Label>
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
          Estimated Platform Benchmark · {km} km
        </p>
        <p className="mt-1 font-semibold text-primary">
          {formatINR(fr.low)} – {formatINR(fr.high)}
        </p>
        <p className="text-xs text-muted-foreground">Suggested fair rate: {formatINR(fr.suggested)}</p>
      </div>

      <div className="sm:col-span-2 pt-2">
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
          Post Load & Match Trucks
        </Button>
      </div>
    </form>
  );
}
