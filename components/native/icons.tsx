/**
 * The icon set from the native redesign — the `i-*` symbols in the project's
 * `screens/*.html`. 24 pt viewBox, outline only, round caps, and the weight the
 * design drew each glyph with (1.7 for rows and chrome, 2.2 for the chevron
 * family). Lucide stays on the desktop pages; the native screens use these so
 * the nav bar, the tab bar, the section headers and the empty states speak one
 * language.
 */
import type { ReactNode, SVGProps } from "react"

export type GlyphName =
  | "cube"
  | "home"
  | "logs"
  | "sites"
  | "calendar"
  | "profile"
  | "plus"
  | "chevRight"
  | "chevLeft"
  | "search"
  | "sliders"
  | "check"
  | "x"
  | "cloudOff"
  | "doc"
  | "camera"
  | "pin"
  | "users"
  | "truck"
  | "box"
  | "weather"
  | "clock"
  | "shield"
  | "pen"
  | "arrowRight"

const WEIGHT: Record<GlyphName, number> = {
  cube: 1.7,
  home: 1.7,
  logs: 1.7,
  sites: 1.7,
  calendar: 1.7,
  profile: 1.7,
  plus: 2,
  chevRight: 2.2,
  chevLeft: 2.2,
  search: 1.8,
  sliders: 1.7,
  check: 2.2,
  x: 2,
  cloudOff: 1.7,
  doc: 1.7,
  camera: 1.7,
  pin: 1.8,
  users: 1.7,
  truck: 1.7,
  box: 1.7,
  weather: 1.7,
  clock: 1.7,
  shield: 1.7,
  pen: 1.7,
  arrowRight: 1.8,
}

const PATHS: Record<GlyphName, ReactNode> = {
  cube: <>
        <path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6z" />
        <path d="M4.4 7.6 12 12l7.6-4.4M12 12v8.8" />
    </>,
  home: <>
        <path d="M3.4 10.3 12 3.5l8.6 6.8" />
        <path d="M5.6 9.4V19a1.5 1.5 0 0 0 1.5 1.5h9.8a1.5 1.5 0 0 0 1.5-1.5V9.4" />
        <path d="M9.7 20.5v-5.1h4.6v5.1" />
    </>,
  logs: <>
        <path d="M8.6 6.6h11.4M8.6 12h11.4M8.6 17.4h7.4" />
        <path d="M4.2 6.6h.02M4.2 12h.02M4.2 17.4h.02" />
    </>,
  sites: <>
        <path d="M3.6 20.4V8.3l6-2.7v14.8" />
        <path d="M9.6 20.4V5.9l10.8 3.3v11.2" />
        <path d="M2.2 20.4h19.6" />
        <path d="M12.7 12h.02M12.7 15.6h.02M16.6 12.9h.02M16.6 16.5h.02" />
    </>,
  calendar: <>
        <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.6" />
        <path d="M3.6 10h16.8M8.2 3.4v4M15.8 3.4v4" />
    </>,
  profile: <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M4.9 20.2a7.1 7.1 0 0 1 14.2 0" />
    </>,
  plus: <>
        <path d="M12 5.2v13.6M5.2 12h13.6" />
    </>,
  chevRight: <>
        <path d="M9.4 5.6 15.8 12l-6.4 6.4" />
    </>,
  chevLeft: <>
        <path d="M14.6 5.6 8.2 12l6.4 6.4" />
    </>,
  search: <>
        <circle cx="10.7" cy="10.7" r="6.2" />
        <path d="M15.3 15.3 19.8 19.8" />
    </>,
  sliders: <>
        <path d="M3.6 8.2h9.2M17.6 8.2h2.8M3.6 15.8h3.6M11.8 15.8h8.6" />
        <circle cx="15.2" cy="8.2" r="2.4" />
        <circle cx="9.4" cy="15.8" r="2.4" />
    </>,
  check: <>
        <path d="M4.8 12.4 9.8 17.4 19.4 6.8" />
    </>,
  x: <>
        <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
    </>,
  cloudOff: <>
        <path d="M4 4.4 20 20" />
        <path d="M8.7 6.6A5.4 5.4 0 0 1 18 9.8a4.1 4.1 0 0 1 2.3 6.4" />
        <path d="M6.6 9A4.6 4.6 0 0 0 7.4 17.4h7.6" />
    </>,
  doc: <>
        <path d="M6.4 3.4h7.2l5 5v12.2H6.4z" />
        <path d="M13.4 3.4v5.1h5.2" />
        <path d="M9.2 12.4h5.6M9.2 16h3.8" />
    </>,
  camera: <>
        <rect x="3.4" y="7.4" width="17.2" height="12.2" rx="2.6" />
        <path d="M8.6 7.4 10 4.6h4l1.4 2.8" />
        <circle cx="12" cy="13.3" r="3" />
    </>,
  pin: <>
        <path d="M12 20.8c3.6-3.8 6.3-7.1 6.3-10.4a6.3 6.3 0 1 0-12.6 0c0 3.3 2.7 6.6 6.3 10.4z" />
        <circle cx="12" cy="10.1" r="2.3" />
    </>,
  users: <>
        <circle cx="9.2" cy="8.4" r="3.2" />
        <path d="M3.6 19.6a5.7 5.7 0 0 1 11.2 0" />
        <path d="M15.9 5.8a3.1 3.1 0 0 1 0 6" />
        <path d="M17.3 14.4a5.4 5.4 0 0 1 3.1 5" />
    </>,
  truck: <>
        <path d="M3.4 6.6h9.8v9.9H3.4z" />
        <path d="M13.2 10.2h4.2l3.2 3.3v3h-7.4z" />
        <circle cx="7" cy="18.6" r="1.7" />
        <circle cx="17.2" cy="18.6" r="1.7" />
    </>,
  box: <>
        <path d="M12 3.4 20.2 8v8.2L12 20.6 3.8 16.2V8z" />
        <path d="M3.8 8 12 12.6 20.2 8M12 12.6v8" />
    </>,
  weather: <>
        <circle cx="9.4" cy="9.4" r="3.3" />
        <path d="M9.4 3.4v1.3M9.4 14.1v1.3M3.4 9.4h1.3M14.1 9.4h1.3M5.2 5.2l.9.9M12.7 12.7l.9.9M13.6 5.2l-.9.9M6.1 12.7l-.9.9" />
        <path d="M14.6 19.4h4.2a2.4 2.4 0 0 0 .2-4.8 3.4 3.4 0 0 0-6.5-.7" />
    </>,
  clock: <>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 7.2V12l3.3 1.9" />
    </>,
  shield: <>
        <path d="M12 3.4 19 5.9v6c0 4.6-2.9 7.3-7 8.6-4.1-1.3-7-4-7-8.6v-6z" />
        <path d="M9.1 12.1l2.1 2.1 3.8-4.2" />
    </>,
  pen: <>
        <path d="M15.4 4.8 19.2 8.6 9.6 18.2H5.8v-3.8z" />
        <path d="M13.6 6.6l3.8 3.8" />
    </>,
  arrowRight: <>
        <path d="M4.6 12h14M13 6.4 18.6 12 13 17.6" />
    </>,
}

/** One glyph at any size. Colour comes from `currentColor`. */
export function Glyph({
  name,
  size = 22,
  strokeWidth,
  ...rest
}: { name: GlyphName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name" | "size" | "strokeWidth">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? WEIGHT[name]}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
