import { useState } from "react";
import { MapPin, Navigation, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CITIES, CITY_NAMES, findNearestCity, resolveLocation } from "@/lib/geo";
import { toast } from "sonner";

export type LocationValue = {
  name: string;
  lat: number;
  lng: number;
};

interface LocationPickerProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (val: LocationValue) => void;
  placeholder?: string;
  className?: string;
}

export function LocationPicker({
  id = "location-picker",
  label,
  value,
  onChange,
  placeholder = "Search city or location...",
  className = "",
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [locating, setLocating] = useState(false);

  const filteredCities = CITY_NAMES.filter((city) =>
    city.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelectCity(cityName: string) {
    const coords = CITIES[cityName as keyof typeof CITIES];
    onChange({ name: cityName, lat: coords.lat, lng: coords.lng });
    setOpen(false);
    setSearch("");
  }

  function handleCustomSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    const resolved = resolveLocation(search);
    onChange(resolved);
    setOpen(false);
    setSearch("");
  }

  function useCurrentGPS() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const nearest = findNearestCity({ lat: latitude, lng: longitude });
        onChange({
          name: `${nearest} (GPS: ${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
          lat: latitude,
          lng: longitude,
        });
        toast.success(`Location set near ${nearest}`);
        setOpen(false);
      },
      (err) => {
        setLocating(false);
        toast.error(`Location access failed: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal bg-background hover:bg-accent/40 text-left truncate"
          >
            <span className="flex items-center gap-2 truncate">
              <MapPin className="size-4 text-primary shrink-0" />
              {value || <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <Search className="size-3.5 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 bg-card border-border shadow-xl rounded-xl z-50" align="start">
          <form onSubmit={handleCustomSearchSubmit} className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Type city or location name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-xs flex items-center gap-1.5"
                onClick={useCurrentGPS}
                disabled={locating}
              >
                <Navigation className={`size-3.5 text-primary ${locating ? "animate-spin" : ""}`} />
                {locating ? "Detecting GPS..." : "Use Current GPS"}
              </Button>
            </div>
          </form>

          <div className="mt-3 max-h-48 overflow-y-auto space-y-1 pr-1">
            <p className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              Popular Cities & Logistics Hubs
            </p>
            {filteredCities.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground text-center">
                Press Enter to use &ldquo;{search}&rdquo; as custom location
              </div>
            ) : (
              filteredCities.map((city) => {
                const isSelected = value.toLowerCase().includes(city.toLowerCase());
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-md transition-colors text-left ${
                      isSelected
                        ? "bg-primary/15 text-primary font-medium"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      {city}
                    </span>
                    {isSelected && <Check className="size-4 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
