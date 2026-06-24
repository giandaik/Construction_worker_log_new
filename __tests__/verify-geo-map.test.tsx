import { StrictMode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LeafletMap } from "@/components/projects/LeafletMap";

// React 18 StrictMode runs every effect setup → cleanup → setup in development.
// If the Leaflet map were created and destroyed in mismatched lifecycle hooks,
// the second setup would call `L.map(node)` on a container that still carries
// `_leaflet_id`, throwing "Map container is already initialized". These tests
// guard the single-effect lifecycle that prevents that.
describe("LeafletMap — StrictMode lifecycle", () => {
  it("mounts under StrictMode (setup → cleanup → setup) without re-init error", () => {
    expect(() =>
      render(
        <StrictMode>
          <LeafletMap latitude={37.9838} longitude={23.7275} />
        </StrictMode>
      )
    ).not.toThrow();
    cleanup();
  });

  it("supports an interactive (onSelect) map under StrictMode", () => {
    const onSelect = vi.fn();
    expect(() =>
      render(
        <StrictMode>
          <LeafletMap latitude={37.9838} longitude={23.7275} onSelect={onSelect} />
        </StrictMode>
      )
    ).not.toThrow();
    cleanup();
  });

  it("re-mounts cleanly after an unmount (no leaked container)", () => {
    const first = render(
      <StrictMode>
        <LeafletMap latitude={37.9838} longitude={23.7275} />
      </StrictMode>
    );
    first.unmount();

    expect(() =>
      render(
        <StrictMode>
          <LeafletMap latitude={40.7128} longitude={-74.006} />
        </StrictMode>
      )
    ).not.toThrow();
    cleanup();
  });
});
