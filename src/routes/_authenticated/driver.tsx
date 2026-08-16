import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Stat } from "@/components/Stat";
import { useSession } from "@/hooks/use-session";
import { formatINR, formatKm } from "@/lib/geo";
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
  const lang = (profile?.language as Lang) ?? "hinglish";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["driver-cockpit", profile?.id],
    queryFn: async () => {
      const [{ data: myDriver }, { data: trucks }, { data: loads }, { data: trips }] =
        await Promise.all([
          supabase.from("drivers").select("*").eq("user_id", profile!.id).maybeSingle(),
          supabase.from("trucks").select("*"),
          supabase.from("loads").select("*, shippers(company_name, trust_score)").eq("status", "POSTED"),
          supabase.from("trips").select("*").eq("status", "IN_TRANSIT"),
        ]);
      return { myDriver, trucks: trucks ?? [], loads: loads ?? [], trips: trips ?? [] };
    },
    enabled: !!profile?.id,
  });

  const truck = useMemo(() => {
    if (!data) return null;
    const own = data.trucks.find((tr) => tr.driver_id === data.myDriver?.id);
    return own ?? data.trucks.find((tr) => tr.id === DEMO_TRUCK_ID) ?? data.trucks[0] ?? null;
  }, [data]);

  const trip = data?.trips.find((tp) => tp.truck_id === truck?.id) ?? null;
  const isDemo = truck?.is_demo ?? false;

  const matches = useMemo(() => {
    if (!truck || !data) return [];
    const truckInput: TruckInput = {
      id: truck.id,
      capacity: Number(truck.capacity),
      truck_type: truck.truck_type,
      destination: {
        lat: Number(truck.destination_lat ?? truck.current_lat ?? 0),
        lng: Number(truck.destination_lng ?? truck.current_lng ?? 0),
      },
      homeBase: trip ? { lat: Number(trip.start_lat), lng: Number(trip.start_lng) } : null,
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
      shipper_trust: (l.shippers as { trust_score: number } | null)?.trust_score ?? 4,
      pickup_location: l.pickup_location,
      delivery_location: l.delivery_location,
    }));
    return rankReturnLoads(truckInput, loadInputs, radius);
  }, [truck, data, trip, radius]);

  const best = matches[0];
  const potentialLow = matches.length ? Math.min(...matches.map((m) => m.match.estimatedEarning)) : 0;
  const potentialHigh = matches.length ? Math.max(...matches.map((m) => m.match.estimatedEarning)) : 0;

  const bookMutation = useMutation({
    mutationFn: async (index: number) => {
      const m = matches[index];
      if (!m) throw new Error("missing match");
      const load = data!.loads.find((l) => l.id === m.load.id)!;
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
      await supabase.from("return_load_opportunities").insert({
        truck_id: truck!.id,
        load_id: load.id,
        match_score: m.match.matchScore,
        route_score: m.match.breakdown.route,
        distance_score: m.match.breakdown.distance,
        capacity_score: m.match.breakdown.capacity,
        timing_score: m.match.breakdown.timing,
        price_score: m.match.breakdown.price,
        trust_score: m.match.breakdown.trust,
        estimated_earning: m.match.estimatedEarning,
        empty_km_avoided: m.match.emptyKmAvoided,
        estimated_fuel_saved: m.match.estimatedFuelSaved,
        estimated_co2_avoided: m.match.estimatedCo2Avoided,
        reasons: m.match.reasons,
        status: "ACCEPTED",
      });
    },
    onSuccess: () => {
      toast.success("Booking request sent to the shipper");
      void queryClient.invalidateQueries();
      navigate({ to: "/impact" });
    },
    onError: () => toast.error("Could not send the booking request. Please try again."),
  });

  function findReturnLoad() {
    setSearching(true);
    window.setTimeout(() => {
      setSearching(false);
      setShowMatches(true);
      if (!matches.length) toast.info(t(lang, "noLoads"));
    }, 1100);
  }

  if (isLoading) {
    return <div className="py-24 text-center text-muted-foreground">Loading your cockpit…</div>;
  }
  if (isError || !truck) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-medium">Please verify your truck details.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No truck is linked to this account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t(lang, "greeting")}, {profile?.name ?? "Driver"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {truck.registration_number} · {truck.truck_type} · {Number(truck.capacity)} Ton
          </p>
        </div>
        {isDemo ? <Badge variant="outline" className="text-warning">DEMO MODE</Badge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {t(lang, "currentTrip")}
            </h2>
            <Badge className="bg-warning text-warning-foreground">🟡 {t(lang, "emptySoon")}</Badge>
          </div>
          <p className="mt-3 text-xl font-semibold">
            {trip ? `${trip.start_location} → ${trip.destination}` : `→ ${truck.destination_city}`}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Delivery ETA:{" "}
            {trip?.estimated_arrival
              ? new Date(trip.estimated_arrival).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </p>
          <Progress value={Number(trip?.progress ?? 60)} className="mt-4" />
          <p className="mt-2 text-xs text-muted-foreground">
            Expected availability:{" "}
            {truck.available_from
              ? new Date(truck.available_from).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}{" "}
            near {truck.destination_city}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-4 text-primary" /> {t(lang, "matches")}
          </h2>
          <p className="mt-3 text-3xl font-semibold text-primary">{matches.length}</p>
          <p className="text-sm text-muted-foreground">
            suitable loads within {radius} km of {truck.destination_city}
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
            <Mic className="size-4" /> 🎙️ {t(lang, "voiceButton")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t(lang, "potentialEarning")}
          value={matches.length ? `${formatINR(potentialLow)} – ${formatINR(potentialHigh)}` : "—"}
          hint="Estimated, based on posted budgets"
          tone="primary"
          icon={<IndianRupee className="size-4" />}
        />
        <Stat
          label={t(lang, "emptyKmAvoided")}
          value={best ? formatKm(best.match.emptyKmAvoided) : "—"}
          hint="Estimate for the top match"
          icon={<Truck className="size-4" />}
        />
        <Stat
          label={t(lang, "fuelSaved")}
          value={best ? `~${best.match.estimatedFuelSaved} L` : "—"}
          hint="Estimated at 0.15 L/km"
          icon={<Fuel className="size-4" />}
        />
        <Stat
          label="Estimated CO₂ avoided"
          value={best ? `~${best.match.estimatedCo2Avoided} kg` : "—"}
          hint="Estimated at 2.35 kg/L"
          icon={<Leaf className="size-4" />}
        />
      </div>

      {showMatches ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t(lang, "loadsNearYou")}</h2>
          {matches.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              {t(lang, "noLoads")}
            </div>
          ) : (
            matches.map((m, i) => (
              <article key={m.load.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {m.load.pickup_location} → {m.load.delivery_location}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" /> {m.match.deadheadKm} km from delivery point
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
                    <p className="text-2xl font-semibold">{formatINR(m.match.estimatedEarning)}</p>
                    <Badge className="mt-1">Match {m.match.matchScore}%</Badge>
                  </div>
                </div>

                <ul className="mt-4 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  {m.match.reasons.map((r) => (
                    <li key={r}>✓ {r}</li>
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
                  <Button onClick={() => bookMutation.mutate(i)} disabled={bookMutation.isPending}>
                    {bookMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t(lang, "book")}
                  </Button>
                  <Button variant="secondary" onClick={() => navigate({ to: "/radar" })}>
                    View on radar
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        onConfirm={() => {
          setVoiceOpen(false);
          findReturnLoad();
        }}
        destination={truck.destination_city ?? "Jabalpur"}
        capacity={Number(truck.capacity)}
      />
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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice input is not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setRecording(true);
      recorder.start();
      window.setTimeout(() => {
        recorder.stop();
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        // No speech-to-text key is configured, so we do not fake a transcription
        // API call — demo mode returns the sample intent instead.
        setHeard(
          `Kal ${destination} pahuchunga, ${capacity} ton ka truck khali hoga — return load chahiye.`,
        );
      }, 2500);
    } catch {
      toast.error("Microphone permission is needed to use voice search.");
      setRecording(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🎙️ Bolo aur load dhundo</DialogTitle>
          <DialogDescription>
            Speak in Hindi, Hinglish or English. Nothing is ever booked from voice alone — you always
            confirm first.
          </DialogDescription>
        </DialogHeader>

        {heard ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background p-3 text-sm">{heard}</div>
            <div className="rounded-lg border border-primary/40 bg-card p-3 text-sm">
              <p className="font-medium">Samjha:</p>
              <ul className="mt-1 text-muted-foreground">
                <li>{capacity} ton truck</li>
                <li>Empty near {destination}</li>
                <li>Available: kal</li>
              </ul>
              <p className="mt-2">Kya main return load dhundhu?</p>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <Button size="lg" onClick={record} disabled={recording}>
              {recording ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
              {recording ? "Sun raha hoon…" : "Start speaking"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Demo mode: no speech-to-text provider key is connected, so the sample intent below is
              used after recording.
            </p>
          </div>
        )}

        <DialogFooter>
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
