import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "@/lib/maps";

const SEARCH = "https://www.google.com/maps/search/?api=1&query=";

describe("googleMapsUrl", () => {
  it("prefers coordinates when a site has them", () => {
    expect(googleMapsUrl({ latitude: 38.0745, longitude: 23.8117, query: "Kifisia, Athens" })).toBe(
      `${SEARCH}38.0745%2C23.8117`
    );
  });

  it("falls back to the location text", () => {
    expect(googleMapsUrl({ query: " Kifisia, Athens " })).toBe(`${SEARCH}Kifisia%2C%20Athens`);
  });

  it("passes a pasted Maps link through unchanged", () => {
    const pasted = "https://maps.app.goo.gl/abc123";
    expect(googleMapsUrl({ query: pasted })).toBe(pasted);
  });

  it("returns null when there is nothing to search for", () => {
    expect(googleMapsUrl({})).toBeNull();
    expect(googleMapsUrl({ query: "   " })).toBeNull();
    expect(googleMapsUrl({ latitude: null, longitude: 23.8, query: "" })).toBeNull();
    expect(googleMapsUrl({ latitude: Number.NaN, longitude: 23.8 })).toBeNull();
  });

  it("treats a lone coordinate as missing", () => {
    expect(googleMapsUrl({ latitude: 38.07, query: "Piraeus" })).toBe(`${SEARCH}Piraeus`);
  });
});
