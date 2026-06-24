"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Self-contained pin (inline SVG) so we avoid Leaflet's bundler-broken default
// marker icon and any external CDN dependency. Fill = theme yellow (yellow-600).
const pinIcon = L.divIcon({
  className: "",
  html: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ca8a04"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  /** When provided the marker is draggable and the map is click-to-place. */
  onSelect?: (latitude: number, longitude: number) => void;
  height?: number;
  zoom?: number;
}

export function LeafletMap({
  latitude,
  longitude,
  onSelect,
  height = 300,
  zoom,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Keep the latest onSelect without forcing the map to be torn down and rebuilt.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the Leaflet map exactly once per mount. Doing the create + remove in a
  // single effect guarantees the cleanup (which clears Leaflet's `_leaflet_id`)
  // always runs before the next setup — so React 18 StrictMode's
  // setup → cleanup → setup cycle can never hit "Map container is already
  // initialized". (react-leaflet splits these across a ref callback and a
  // separate effect, which is what made the error possible.)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const interactive = Boolean(onSelectRef.current);
    const map = L.map(container, {
      center: [latitude, longitude],
      zoom: zoom ?? (interactive ? 13 : 15),
      scrollWheelZoom: interactive,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([latitude, longitude], {
      icon: pinIcon,
      draggable: interactive,
    }).addTo(map);
    markerRef.current = marker;

    if (interactive) {
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onSelectRef.current?.(lat, lng);
      });
      map.on("click", (event: L.LeafletMouseEvent) => {
        onSelectRef.current?.(event.latlng.lat, event.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Mount-once: prop-driven updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external coordinate changes (GPS fix, click-to-place, edit hydration)
  // onto the existing map without recreating it.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-md"
    />
  );
}
