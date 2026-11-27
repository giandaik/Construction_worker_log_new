import { ExternalLink, MapPin } from "lucide-react";
import { googleMapsUrl } from "@/lib/maps";

export interface LocationLinkProps {
  /** The site's address / place text. */
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Show the leading pin. Off for places that already draw one. */
  showPin?: boolean;
  /** Tailwind size classes for the glyphs. */
  iconClassName?: string;
  /** Text when the site has no location and no coordinates. */
  emptyLabel?: string;
  /** Wrapper classes — typography is inherited so this drops into any row. */
  className?: string;
}

/**
 * A site location, linked to Google Maps.
 *
 * Plain text was the report: the place name looked tappable and did nothing.
 * Anything that is not a link (no address, no coordinates) stays plain text so
 * the component never renders a dead anchor.
 */
export function LocationLink({
  location,
  latitude,
  longitude,
  showPin = true,
  iconClassName = "h-3 w-3",
  emptyLabel = "No location yet",
  className = "",
}: LocationLinkProps) {
  const text = (location ?? "").trim();
  const href = googleMapsUrl({ latitude, longitude, query: text });
  const label = text || emptyLabel;
  const glyphs = (
    <>
      {showPin ? <MapPin className={`${iconClassName} shrink-0`} aria-hidden /> : null}
    </>
  );

  if (!href) {
    return (
      <span className={className}>
        {glyphs}
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${text || "coordinates"} in Google Maps`}
      aria-label={`Open ${text || "coordinates"} in Google Maps`}
      className={`${className} underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none`}
    >
      {glyphs}
      <span className="truncate">{text}</span>
      <ExternalLink className={`${iconClassName} shrink-0 opacity-60`} aria-hidden />
    </a>
  );
}
