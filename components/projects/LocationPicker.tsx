"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectMap } from "./ProjectMap";
import { reverseGeocode } from "@/lib/geocode";

// Fallback center when no coordinates are set yet.
const DEFAULT_CENTER = { latitude: 37.9838, longitude: 23.7275 }; // Athens, GR

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  /** Called with the chosen coordinates plus a best-effort reverse-geocoded address. */
  onCoordinates: (result: {
    latitude: number;
    longitude: number;
    address?: string | null;
  }) => void;
}

export function LocationPicker({
  latitude,
  longitude,
  onCoordinates,
}: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const hasCoords = latitude != null && longitude != null;

  async function applyCoordinates(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    onCoordinates({ latitude: lat, longitude: lng, address });
  }

  function useMyLocation() {
    setGeoError(null);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("Geolocation isn't supported by this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        void applyCoordinates(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied — pick a spot on the map instead."
            : "Couldn't get your location — pick a spot on the map instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {hasCoords
            ? `${latitude?.toFixed(5)}, ${longitude?.toFixed(5)}`
            : "No location set — click the map or use GPS."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          disabled={locating}
        >
          <MapPin className="mr-1 h-4 w-4" />
          {locating ? "Locating…" : "Use my location"}
        </Button>
      </div>
      {geoError && <p className="text-sm text-destructive">{geoError}</p>}
      <ProjectMap
        latitude={latitude ?? DEFAULT_CENTER.latitude}
        longitude={longitude ?? DEFAULT_CENTER.longitude}
        onSelect={applyCoordinates}
      />
    </div>
  );
}
