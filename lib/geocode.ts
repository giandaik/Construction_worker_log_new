/**
 * Best-effort reverse geocoding via the public OpenStreetMap Nominatim endpoint.
 *
 * Nominatim usage policy: one request per action (never in a loop), and requests
 * must identify the calling application. Browser fetches automatically send a
 * Referer header that identifies this app. Keep calls infrequent — this is only
 * fired when a user drops a pin or uses GPS on a project form.
 */

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Resolve coordinates to a human-readable address.
 * Returns null on any failure so callers can degrade gracefully.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=0`;

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;

    const data = (await response.json()) as { display_name?: unknown };
    const name = data?.display_name;

    return typeof name === 'string' && name.trim() ? name : null;
  } catch {
    return null;
  }
}
