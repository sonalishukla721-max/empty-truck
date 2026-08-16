import { cn } from "@/lib/utils";

export type RadarPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "load" | "truck" | "empty_soon" | "hotspot";
};

const BOUNDS = { minLat: 17.5, maxLat: 29.5, minLng: 71.5, maxLng: 81.5 };

const KIND_CLASS: Record<RadarPoint["kind"], string> = {
  load: "bg-primary",
  truck: "bg-chart-2",
  empty_soon: "bg-warning",
  hotspot: "bg-destructive",
};

/**
 * Lightweight vector radar. No map vendor key is configured, so this renders a
 * schematic corridor view instead of pretending a live map tile API is connected.
 */
export function RadarMap({
  points,
  selectedId,
  onSelect,
  className,
}: {
  points: RadarPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const project = (lat: number, lng: number) => ({
    x: ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100,
    y: (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100,
  });

  return (
    <div
      className={cn(
        "surface-grid relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_65%)]" />
      {points.map((p) => {
        const { x, y } = project(p.lat, p.lng);
        const active = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect?.(p.id)}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            aria-label={p.label}
          >
            <span
              className={cn(
                "block size-3 rounded-full ring-2 ring-background transition-transform",
                KIND_CLASS[p.kind],
                active && "scale-150",
                p.kind === "empty_soon" && "animate-pulse",
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground opacity-0 transition-opacity group-hover:opacity-100",
                active && "opacity-100",
              )}
            >
              {p.label}
            </span>
          </button>
        );
      })}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg border border-border bg-background/80 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
        <Legend className="bg-primary" label="Return loads" />
        <Legend className="bg-chart-2" label="Active trucks" />
        <Legend className="bg-warning" label="Empty soon" />
        <Legend className="bg-destructive" label="Empty-truck zone" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} /> {label}
    </span>
  );
}
