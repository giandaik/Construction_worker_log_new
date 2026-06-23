"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
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

function ClickHandler({
  onSelect,
}: {
  onSelect: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click: (event) => onSelect(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

export function LeafletMap({
  latitude,
  longitude,
  onSelect,
  height = 300,
  zoom,
}: LeafletMapProps) {
  const interactive = Boolean(onSelect);

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={zoom ?? (interactive ? 13 : 15)}
      scrollWheelZoom={interactive}
      style={{ height, width: "100%" }}
      className="rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[latitude, longitude]}
        icon={pinIcon}
        draggable={interactive}
        eventHandlers={
          interactive
            ? {
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const { lat, lng } = marker.getLatLng();
                  onSelect?.(lat, lng);
                },
              }
            : undefined
        }
      />
      {interactive && onSelect && <ClickHandler onSelect={onSelect} />}
    </MapContainer>
  );
}
