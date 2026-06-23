"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import, so it must never run on the server.
const LeafletMap = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />
    ),
  }
);

export interface ProjectMapProps {
  latitude: number;
  longitude: number;
  /** When provided the marker is draggable and the map is click-to-place. */
  onSelect?: (latitude: number, longitude: number) => void;
  height?: number;
  zoom?: number;
}

/** SSR-safe wrapper around the browser-only Leaflet map. */
export function ProjectMap(props: ProjectMapProps) {
  return <LeafletMap {...props} />;
}
