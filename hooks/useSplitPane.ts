"use client";

import { useEffect, useState } from "react";

/**
 * True once the viewport is wide enough for the tablet master–detail split.
 *
 * Starts `false` so the server render and the first client paint agree — a
 * `matchMedia` read during render is a hydration mismatch waiting to happen.
 * The effect flips it on the frame after mount, which is why the phone layout
 * stays the default rather than the thing that gets corrected afterwards.
 */
export const SPLIT_QUERY = "(min-width: 1000px)";

export function useSplitPane(): boolean {
  const [split, setSplit] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(SPLIT_QUERY);
    const apply = () => setSplit(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return split;
}
