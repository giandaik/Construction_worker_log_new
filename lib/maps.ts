/**
 * Google Maps deep links for site locations.
 *
 * Coordinates win when a site has them (they survive a bad address); otherwise
 * the location text becomes a Maps search. A location that is already a URL —
 * admins do paste `maps.app.goo.gl` links into the field — is passed through
 * untouched instead of being searched for as a phrase.
 */

export interface MapsTarget {
  latitude?: number | null;
  longitude?: number | null;
  query?: string | null;
}

const SEARCH = "https://www.google.com/maps/search/?api=1&query=";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function googleMapsUrl({ latitude, longitude, query }: MapsTarget): string | null {
  if (isFiniteNumber(latitude) && isFiniteNumber(longitude)) {
    return `${SEARCH}${latitude}%2C${longitude}`;
  }

  const text = (query ?? "").trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) return text;

  return `${SEARCH}${encodeURIComponent(text)}`;
}
