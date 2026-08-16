import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Truck,
  Fuel,
  Leaf,
  IndianRupee,
  Mic,
  Loader2,
  Sparkles,
  MapPin,
  Clock,
  PlusCircle,
  Edit3,
  Navigation,
  CheckCircle,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Stat } from "@/components/Stat";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { RatingDialog } from "@/components/RatingDialog";
import { useSession } from "@/hooks/use-session";
import { formatINR, formatKm, resolveLocation } from "@/lib/geo";
import { rankReturnLoads, type LoadInput, type TruckInput } from "@/lib/matching";
import { t, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "Driver dashboard — return loads before you run empty" },
      {
        name: "description",
        content:
          "See when your truck becomes empty, get ranked return-load matches near your delivery point, and book the best one.",
      },
      { property: "og:title", content: "Driver dashboard — TruckLoad AI" },
      {
        property: "og:description",
        content: "Predicted empty time, ranked return loads and estimated impact for your truck.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriverDashboard,
});

const DEMO_TRUCK_ID = "33333333-3333-3333-3333-333333333301";

function DriverDashboard() {
  const { profile } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState(50);
  const [searching, setSearching] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [truckDialogOpen, setTruckDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [activeRatingTrip, setActiveRatingTrip] = useState<{
    bookingId: string;
    shipperUserId: string;
  } | null>(null);

  const lang = (profile?.language as Lang) ?? "hinglish";

  // Realtime subscription for bookings and trips
  useEffect(() => {
    const channel = supabase
      .channel("driver-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["driver-cockpit"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["driver-cockpit"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "loads" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["driver-cockpit"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["driver-cockpit", profile?.id],
    queryFn: async () => {
      let { data: myDriver } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", profile!.id)
        .maybeSingle();

      // Ensure driver record exists if profile is DRIVER
      if (!myDriver && profile?.id) {
        const { data: newDriver } = await supabase
          .from("drivers")
          .insert({
            user_id: profile.id,
            name: profile.name || "Driver",
            phone: profile.phone || "",
            trust_score: 4.8,
            kyc_status: "VERIFIED",
          })
          .select()
          .single();
        myDriver = newDriver;
      }

      const [{ data: trucks }, { data: loads }, { data: trips }, { data: bookings }] =
        await Promise.all([
          supabase.from("trucks").select("*"),
          supabase.from("loads").select("*, shippers(id, user_id, company_name, trust_score)").eq("status", "POSTED"),
          supabase.from("trips").select("*, bookings(*)").order("created_at", { ascending: false }),
          supabase.from("bookings").select("*, loads(*)").order("created_at", { ascending: false }),
        ]);

      return {
        myDriver,
        trucks: trucks ?? [],
        loads: loads ?? [],
        trips: trips ?? [],
        bookings: bookings ?? [],
      };
    },
    enabled: !!profile?.id,
  });

  const truck = useMemo(() => {
    if (!data) return null;
    const own = data.trucks.find((tr) => tr.driver_id === data.myDriver?.id);
    return own ?? data.trucks.find((tr) => tr.id === DEMO_TRUCK_ID) ?? data.trucks[0] ?? null;
  }, [data]);

  const activeTrip = useMemo(() => {
    if (!data || !truck) return null;
    return data.trips.find(
      (tp) => tp.truck_id === truck.id && (tp.status === "IN_TRANSIT" || tp.status === "BOOKED")
    ) ?? null;
  }, [data, truck]);

  const myBookings = useMemo(() => {
    if (!data || !truck) return [];
    return data.bookings.filter((b) => b.truck_id === truck.id || b.driver_id === data.myDriver?.id);
  }, [data, truck]);

  const isDemo = truck?.is_demo ?? false;

  const matches = useMemo(() => {
    if (!truck || !data) return [];
    const truckInput: TruckInput = {
      id: truck.id,
      capacity: Number(truck.capacity),
      truck_type: truck.truck_type,
      destination: {
        lat: Number(truck.destination_lat ?? truck.current_lat ?? 23.1815),
        lng: Number(truck.destination_lng ?? truck.current_lng ?? 79.9864),
      },
      homeBase: activeTrip ? { lat: Number(activeTrip.start_lat ?? 23.1815), lng: Number(activeTrip.start_lng ?? 79.9864) } : null,
      available_from: truck.available_from,
    };
    const loadInputs: LoadInput[] = data.loads.map((l) => ({
      id: l.id,
      pickup: { lat: Number(l.pickup_lat), lng: Number(l.pickup_lng) },
      delivery: { lat: Number(l.delivery_lat), lng: Number(l.delivery_lng) },
      weight: Number(l.weight),
      truck_type: l.truck_type,
      budget: Number(l.budget),
      pickup_time: l.pickup_time,
      shipper_trust: (l.shippers as any)?.trust_score ?? 4.5,
      pickup_location: l.pickup_location,
      delivery_location: l.delivery_location,
    }));
    return rankReturnLoads(truckInput, loadInputs, radius);
  }, [truck, data, activeTrip, radius]);

  const best = matches[0];
  const potentialLow = matches.length ? Math.min(...matches.map((m) => m.match.estimatedEarning)) : 0;
  const potentialHigh = matches.length ? Math.max(...matches.map((m) => m.match.estimatedEarning)) : 0;

  const bookMutation = useMutation({
    mutationFn: async (index: number) => {
      const m = matches[index];
      if (!m) throw new Error("Missing match");
      const load = data!.loads.find((l) => l.id === m.load.id)!;

      // Check if already booked
      const existing = data!.bookings.find(
        (b) => b.load_id === load.id && b.truck_id === truck!.id && b.status !== "CANCELLED"
      );
      if (existing) {
        throw new Error("You already have an active booking request for this load.");
      }

      const { error } = await supabase.from("bookings").insert({
        load_id: load.id,
        truck_id: truck!.id,
        driver_id: data!.myDriver?.id ?? truck!.driver_id,
        shipper_id: load.shipper_id,
        agreed_rate: Number(load.budget),
        status: "REQUESTED",
        empty_km_avoided: m.match.emptyKmAvoided,
        fuel_saved: m.match.estimatedFuelSaved,
        co2_avoided: m.match.estimatedCo2Avoided,
      });
      if (error) throw error;
      await supabase.from("loads").update({ status: "MATCHED" }).eq("id", load.id);
    },
    onSuccess: () => {
      toast.success("Booking request sent to the shipper!");
      void queryClient.invalidateQueries();
    },
    onError: (err: any) => toast.error(err?.message || "Could not send the booking request."),
  });

  const updateTripProgressMutation = useMutation({
    mutationFn: async ({ tripId, progress, isCompleted }: { tripId: string; progress: number; isCompleted?: boolean }) => {
      const updates: any = { progress };
      if (isCompleted) {
        updates.status = "COMPLETED";
      } else if (progress > 0) {
        updates.status = "IN_TRANSIT";
      }

      const { error: tripErr } = await supabase.from("trips").update(updates).eq("id", tripId);
      if (tripErr) throw tripErr;

      if (isCompleted && activeTrip) {
        // Complete booking & load
        if (activeTrip.booking_id) {
          await supabase.from("bookings").update({ status: "COMPLETED" }).eq("id", activeTrip.booking_id);
          const { data: bData } = await supabase.from("bookings").select("*, loads(*)").eq("id", activeTrip.booking_id).single();
          if (bData?.load_id) {
            await supabase.from("loads").update({ status: "DELIVERED" }).eq("id", bData.load_id);
          }
        }

        // Update driver stats
        if (data?.myDriver) {
          const currentTrips = Number(data.myDriver.completed_trips ?? 0) + 1;
          const currentEmptyKm = Number(data.myDriver.empty_km_avoided ?? 0) + 240;
          const currentIncome = Number(data.myDriver.additional_income ?? 0) + 18000;
          await supabase.from("drivers").update({
            completed_trips: currentTrips,
            empty_km_avoided: currentEmptyKm,
            additional_income: currentIncome,
            return_loads_found: Number(data.myDriver.return_loads_found ?? 0) + 1,
          }).eq("id", data.myDriver.id);
        }
      }
    },
    onSuccess: (_, vars) => {
      if (vars.isCompleted) {
        toast.success("Trip completed successfully! Outstanding job! 🎉");
        const b = (activeTrip as any)?.bookings;
        const shipperUserId = b?.shipper_id; // or user_id
        if (activeTrip?.booking_id && shipperUserId) {
          setActiveRatingTrip({
            bookingId: activeTrip.booking_id,
            shipperUserId: shipperUserId,
          });
          setRatingDialogOpen(true);
        }
      } else {
        toast.success("Trip progress updated");
      }
      void queryClient.invalidateQueries();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update trip progress."),
  });

  function findReturnLoad() {
    setSearching(true);
    window.setTimeout(() => {
      setSearching(false);
      setShowMatches(true);
      if (!matches.length) toast.info(t(lang, "noLoads"));
    }, 800);
  }

  if (isLoading) {
    return <div className="py-24 text-center text-muted-foreground">Loading your cockpit…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t(lang, "greeting")}, {profile?.name ?? "Driver"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {truck ? `${truck.registration_number} · ${truck.truck_type} · ${Number(truck.capacity)} Ton` : "No truck registered yet"}
            {data?.myDriver?.trust_score && ` · Trust: ${data.myDriver.trust_score} ⭐`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && <Badge variant="outline" className="text-warning">DEMO MODE</Badge>}
          <Button variant="outline" size="sm" onClick={() => setTruckDialogOpen(true)} className="gap-1.5">
            {truck && !isDemo ? <Edit3 className="size-4" /> : <PlusCircle className="size-4" />}
            {truck && !isDemo ? "Edit Truck" : "Register Truck"}
          </Button>
          {truck && (
            <Button variant="outline" size="sm" onClick={() => setLocationDialogOpen(true)} className="gap-1.5">
              <Navigation className="size-4 text-primary" /> Update Route / GPS
            </Button>
          )}
        </div>
      </div>

      {/* Main Cockpit Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active Trip / Availability Card */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {activeTrip ? "Active Trip in Transit" : t(lang, "currentTrip")}
            </h2>
            <Badge className={activeTrip ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"}>
              {activeTrip ? "🟢 IN TRANSIT" : `🟡 ${t(lang, "emptySoon")}`}
            </Badge>
          </div>

          <p className="mt-3 text-xl font-semibold">
            {activeTrip
              ? `${activeTrip.start_location || "Origin"} → ${activeTrip.destination || "Destination"}`
              : `Current Route → ${truck?.destination_city || "Jabalpur"}`}
          </p>

          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            ETA / Expected:{" "}
            {truck?.available_from
              ? new Date(truck.available_from).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Next 24 Hours"}
          </p>

          {activeTrip ? (
            <div className="mt-4 space-y-3 bg-background/60 p-4 rounded-xl border border-border">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Trip Progress: {activeTrip.progress || 0}%</span>
                <span className="text-muted-foreground">{activeTrip.status}</span>
              </div>
              <Slider
                value={[Number(activeTrip.progress || 0)]}
                min={0}
                max={100}
                step={10}
                onValueChange={(val) => {
                  updateTripProgressMutation.mutate({ tripId: activeTrip.id, progress: val[0] ?? 0 });
                }}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  onClick={() =>
                    updateTripProgressMutation.mutate({ tripId: activeTrip.id, progress: 100, isCompleted: true })
                  }
                  disabled={updateTripProgressMutation.isPending}
                >
                  <CheckCircle className="size-4" /> Complete Trip & Delivery
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Progress value={60} className="mt-4" />
              <p className="mt-2 text-xs text-muted-foreground">
                Destination: <span className="font-medium text-foreground">{truck?.destination_city || "Jabalpur"}</span> · Ready for return loads.
              </p>
            </>
          )}
        </div>

        {/* Matches Search Trigger Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-4 text-primary" /> {t(lang, "matches")}
          </h2>
          <p className="mt-3 text-3xl font-semibold text-primary">{matches.length}</p>
          <p className="text-sm text-muted-foreground">
            suitable loads within {radius} km of {truck?.destination_city || "your stop"}
          </p>
          <div className="mt-4">
            <label className="text-xs text-muted-foreground" htmlFor="radius">
              Search radius: {radius} km
            </label>
            <Slider
              id="radius"
              value={[radius]}
              min={10}
              max={150}
              step={10}
              onValueChange={(v) => setRadius(v[0] ?? 50)}
              className="mt-2"
            />
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={findReturnLoad} disabled={searching}>
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
            {t(lang, "findReturnLoad")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="mt-2 w-full"
            onClick={() => setVoiceOpen(true)}
          >
            <Mic className="size-4 text-primary" /> 🎙️ {t(lang, "voiceButton")}
          </Button>
        </div>
      </div>

      {/* Driver Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t(lang, "potentialEarning")}
          value={matches.length ? `${formatINR(potentialLow)} – ${formatINR(potentialHigh)}` : "—"}
          hint="Calculated from active shipper postings"
          tone="primary"
          icon={<IndianRupee className="size-4" />}
        />
        <Stat
          label={t(lang, "emptyKmAvoided")}
          value={best ? formatKm(best.match.emptyKmAvoided) : `${data?.myDriver?.empty_km_avoided ?? 0} km`}
          hint="Empty highway deadhead eliminated"
          icon={<Truck className="size-4" />}
        />
        <Stat
          label={t(lang, "fuelSaved")}
          value={best ? `~${best.match.estimatedFuelSaved} L` : "—"}
          hint="Estimated at 0.15 L/km"
          icon={<Fuel className="size-4" />}
        />
        <Stat
          label="Completed Trips"
          value={String(data?.myDriver?.completed_trips ?? 0)}
          hint={`Trust score: ${data?.myDriver?.trust_score ?? 4.8} ⭐`}
          icon={<Award className="size-4" />}
        />
      </div>

      {/* Return Loads Results Section */}
      {showMatches && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t(lang, "loadsNearYou")}</h2>
            <Badge variant="outline">{matches.length} Available</Badge>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              {t(lang, "noLoads")}
            </div>
          ) : (
            matches.map((m, i) => {
              const isAlreadyRequested = myBookings.some((b) => b.load_id === m.load.id);
              return (
                <article key={m.load.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {m.load.pickup_location} → {m.load.delivery_location}
                      </h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <MapPin className="size-3.5 text-primary" /> {m.match.deadheadKm} km from delivery point
                        </span>
                        <span>{m.load.weight} Ton</span>
                        <span>{m.load.truck_type}</span>
                        <span>
                          {new Date(m.load.pickup_time).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-primary">{formatINR(m.match.estimatedEarning)}</p>
                      <Badge className="mt-1 bg-primary/15 text-primary border-primary/30">
                        {m.match.matchScore}% Match
                      </Badge>
                    </div>
                  </div>

                  <ul className="mt-4 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                    {m.match.reasons.map((r) => (
                      <li key={r} className="flex items-center gap-1.5">
                        <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 text-sm sm:grid-cols-4">
                    <ImpactCell label="Empty KM avoided" value={formatKm(m.match.emptyKmAvoided)} />
                    <ImpactCell label="Est. fuel saved" value={`~${m.match.estimatedFuelSaved} L`} />
                    <ImpactCell label="Est. CO₂ avoided" value={`~${m.match.estimatedCo2Avoided} kg`} />
                    <ImpactCell
                      label="Estimated platform rate"
                      value={`${formatINR(m.match.fairRate.low)} – ${formatINR(m.match.fairRate.high)}`}
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => bookMutation.mutate(i)}
                      disabled={bookMutation.isPending || isAlreadyRequested}
                      className="gap-2"
                    >
                      {bookMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
                      {isAlreadyRequested ? "Request Sent" : t(lang, "book")}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate({ to: "/radar" })}>
                      View on radar
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {/* Voice Assistant Modal */}
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        onConfirm={() => {
          setVoiceOpen(false);
          findReturnLoad();
        }}
        destination={truck?.destination_city ?? "Jabalpur"}
        capacity={Number(truck?.capacity ?? 10)}
      />

      {/* Add / Edit Truck Modal */}
      <TruckFormDialog
        open={truckDialogOpen}
        onOpenChange={setTruckDialogOpen}
        driverId={data?.myDriver?.id}
        existingTruck={truck && !isDemo ? truck : null}
        onSuccess={() => void queryClient.invalidateQueries()}
      />

      {/* Update Location & Destination Modal */}
      <UpdateLocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        truck={truck}
        onSuccess={() => void queryClient.invalidateQueries()}
      />

      {/* Rating Dialog when Trip is Finished */}
      {activeRatingTrip && (
        <RatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          bookingId={activeRatingTrip.bookingId}
          fromUserId={profile?.id || ""}
          toUserId={activeRatingTrip.shipperUserId}
          targetRole="SHIPPER"
          onSuccess={() => setActiveRatingTrip(null)}
        />
      )}
    </div>
  );
}

function ImpactCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function TruckFormDialog({
  open,
  onOpenChange,
  driverId,
  existingTruck,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId?: string;
  existingTruck?: any;
  onSuccess: () => void;
}) {
  const [regNumber, setRegNumber] = useState(existingTruck?.registration_number || "MP 20 GA 4421");
  const [truckType, setTruckType] = useState(existingTruck?.truck_type || "10-Wheeler");
  const [capacity, setCapacity] = useState(String(existingTruck?.capacity || "10"));
  const [vehicleModel, setVehicleModel] = useState(existingTruck?.vehicle_model || "Tata Signa 2823");
  const [fuelType, setFuelType] = useState(existingTruck?.fuel_type || "DIESEL");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverId) {
      toast.error("Driver profile not found");
      return;
    }
    setSaving(true);
    try {
      if (existingTruck?.id) {
        const { error } = await supabase
          .from("trucks")
          .update({
            registration_number: regNumber,
            truck_type: truckType,
            capacity: Number(capacity),
            vehicle_model: vehicleModel,
            fuel_type: fuelType,
          })
          .eq("id", existingTruck.id);
        if (error) throw error;
        toast.success("Truck details updated!");
      } else {
        const { error } = await supabase.from("trucks").insert({
          driver_id: driverId,
          registration_number: regNumber,
          truck_type: truckType,
          capacity: Number(capacity),
          vehicle_model: vehicleModel,
          fuel_type: fuelType,
          current_city: "Jabalpur",
          current_lat: 23.1815,
          current_lng: 79.9864,
          destination_city: "Indore",
          destination_lat: 22.7196,
          destination_lng: 75.8577,
          status: "EMPTY_SOON",
          is_demo: false,
        });
        if (error) throw error;
        toast.success("Truck registered successfully!");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save truck");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{existingTruck ? "Edit Truck Details" : "Register Your Truck"}</DialogTitle>
          <DialogDescription>
            Enter your vehicle registration and capacity for accurate return-load matching.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reg-num">Registration Number</Label>
            <Input
              id="reg-num"
              placeholder="e.g. MP 20 GA 4421"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tt-sel">Truck Type</Label>
              <Select value={truckType} onValueChange={setTruckType}>
                <SelectTrigger id="tt-sel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["6-Wheeler", "10-Wheeler", "12-Wheeler", "14-Wheeler", "Trailer"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap-num">Capacity (Tonnes)</Label>
              <Input
                id="cap-num"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="v-model">Vehicle Model</Label>
              <Input
                id="v-model"
                placeholder="e.g. Tata Prima / Ashok Leyland"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="f-type">Fuel Type</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger id="f-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["DIESEL", "CNG", "LNG", "ELECTRIC"].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save Truck"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UpdateLocationDialog({
  open,
  onOpenChange,
  truck,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  truck: any;
  onSuccess: () => void;
}) {
  const [currentLoc, setCurrentLoc] = useState<LocationValue>({
    name: truck?.current_city || "Jabalpur",
    lat: Number(truck?.current_lat || 23.1815),
    lng: Number(truck?.current_lng || 79.9864),
  });

  const [destLoc, setDestLoc] = useState<LocationValue>({
    name: truck?.destination_city || "Indore",
    lat: Number(truck?.destination_lat || 22.7196),
    lng: Number(truck?.destination_lng || 75.8577),
  });

  const [availableFrom, setAvailableFrom] = useState(
    truck?.available_from ? new Date(truck.available_from).toISOString().slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!truck?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trucks")
        .update({
          current_city: currentLoc.name,
          current_lat: currentLoc.lat,
          current_lng: currentLoc.lng,
          destination_city: destLoc.name,
          destination_lat: destLoc.lat,
          destination_lng: destLoc.lng,
          available_from: availableFrom ? new Date(availableFrom).toISOString() : new Date().toISOString(),
        })
        .eq("id", truck.id);

      if (error) throw error;
      toast.success("Location and destination updated!");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Update Location & Destination</DialogTitle>
          <DialogDescription>
            Where is your truck now, and where will it become empty?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <LocationPicker
            label="Current Location (or GPS)"
            value={currentLoc.name}
            onChange={setCurrentLoc}
          />

          <LocationPicker
            label="Destination (Where truck becomes empty)"
            value={destLoc.name}
            onChange={setDestLoc}
          />

          <div className="space-y-2">
            <Label htmlFor="avail-time">Expected Availability Date & Time</Label>
            <Input
              id="avail-time"
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Update Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoiceDialog({
  open,
  onOpenChange,
  onConfirm,
  destination,
  capacity,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  destination: string;
  capacity: number;
}) {
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);

  async function record() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Voice input is not supported on this browser. Try Chrome.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN"; // Hindi/Hinglish
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setRecording(true);
        setHeard(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setHeard(transcript);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          toast.error("Voice error: " + event.error);
        }
        setRecording(false);
      };

      recognition.onend = () => {
        setRecording(false);
        setHeard((prev) => prev || `Kal ${destination} pahuchunga, ${capacity} ton ka truck khali hoga — return load chahiye.`);
      };

      recognition.start();
    } catch {
      toast.error("Could not start voice recognition.");
      setRecording(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>🎙️ Bolo aur load dhundo</DialogTitle>
          <DialogDescription>
            Speak in Hindi, Hinglish or English. Listen to voice and search return loads.
          </DialogDescription>
        </DialogHeader>

        {heard ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background p-3 text-sm">{heard}</div>
            <div className="rounded-lg border border-primary/40 bg-card p-3 text-sm">
              <p className="font-medium text-foreground">Samjha:</p>
              <ul className="mt-1 text-muted-foreground text-xs space-y-0.5">
                <li>• {capacity} ton truck</li>
                <li>• Empty near {destination}</li>
                <li>• Available: kal / agle 24 ghante</li>
              </ul>
              <p className="mt-2 text-primary font-medium">Kya main return load dhundhu?</p>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <Button size="lg" onClick={record} disabled={recording} className="gap-2">
              {recording ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
              {recording ? "Sun raha hoon…" : "Boliye (Start Speaking)"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Microphone access allow karein aur Hindi ya English me bole.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={() => setHeard(null)}>
            Edit
          </Button>
          <Button onClick={onConfirm} disabled={!heard}>
            Yes, find load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

