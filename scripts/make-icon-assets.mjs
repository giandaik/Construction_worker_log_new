/**
 * Generates the Capacitor asset sources in `assets/` from the brand logo.
 *
 * Source of truth: public/sitely-logo.png (mark + wordmark + tagline on
 * transparency). Only the mark is used for the icon and splash; its bounding
 * box is detected from the alpha channel so a re-exported logo keeps working.
 *
 * After running this, regenerate the platform icons/splashes with:
 *   npm run assets:generate
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const LOGO = "public/sitely-logo.png";
const OUT = "assets";
const BG = "#151a21"; // matches --foreground / app dark surface
const GLOW = "#fbbf24"; // brand hazard amber

/** Bounding box of the first (top-most) opaque run — the mark above the wordmark. */
async function markBox(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const alpha = (x, y) => data[(y * w + x) * ch + 3];

  let runStart = -1;
  let markTop = -1;
  let markBottom = -1;
  for (let y = 0; y < h; y++) {
    let opaque = 0;
    for (let x = 0; x < w; x++) if (alpha(x, y) > 30) opaque++;
    if (opaque > 2 && runStart < 0) runStart = y;
    if (opaque <= 2 && runStart >= 0) {
      if (markTop < 0) {
        markTop = runStart;
        markBottom = y - 1;
      }
      runStart = -1;
    }
  }
  if (markTop < 0) throw new Error("no opaque content found in logo");

  let left = w;
  let right = 0;
  for (let y = markTop; y <= markBottom; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) > 30) {
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, top: markTop, width: right - left + 1, height: markBottom - markTop + 1 };
}

/** Soft amber halo behind the mark, so the icon still carries the brand colour. */
function glowSvg(size, opacity) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="50%" cy="46%" r="42%">
        <stop offset="0%" stop-color="${GLOW}" stop-opacity="${opacity}"/>
        <stop offset="55%" stop-color="${GLOW}" stop-opacity="${opacity * 0.35}"/>
        <stop offset="100%" stop-color="${GLOW}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
  </svg>`);
}

async function canvas(size, { background = BG, glowOpacity = 0.22 } = {}) {
  const layers = [];
  if (glowOpacity > 0) layers.push({ input: glowSvg(size, glowOpacity), top: 0, left: 0 });
  return sharp({ create: { width: size, height: size, channels: 4, background } }).composite(layers);
}

const box = await markBox(LOGO);
const mark = await sharp(LOGO).extract(box).png().toBuffer();

/** Resize the mark to a target height, preserving aspect. */
async function markAt(height) {
  const buf = await sharp(mark).resize({ height, fit: "contain", kernel: "lanczos3" }).png().toBuffer();
  const { width } = await sharp(buf).metadata();
  return { buf, width };
}

await mkdir(OUT, { recursive: true });

// 1024 master icon: mark at 62% of the canvas height.
{
  const m = await markAt(635);
  await (await canvas(1024)).composite([{ input: m.buf, gravity: "center" }]).png().toFile(`${OUT}/icon.png`);
}

// Adaptive-icon layers (Android masks to a circle: keep the mark inside the safe zone).
{
  const m = await markAt(430);
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: m.buf, gravity: "center" }])
    .png()
    .toFile(`${OUT}/icon-foreground.png`);
  await (await canvas(1024, { glowOpacity: 0.28 })).png().toFile(`${OUT}/icon-background.png`);
}

// Splash: 2732x2732. The app boots on the brand amber (see capacitor.config.ts
// and STATUS_BAR_COLOR), so the light splash keeps that field and sits the mark
// on a dark plate — gold-on-amber would otherwise wash out. The dark variant is
// the whole thing inverted for dark-mode devices.
{
  const S = 2732;
  const plate = 1180;
  const radius = Math.round(plate * 0.22);
  const m = await markAt(640);
  const plateSvg = Buffer.from(`<svg width="${plate}" height="${plate}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${plate}" height="${plate}" rx="${radius}" ry="${radius}" fill="${BG}"/>
  </svg>`);
  const plateMark = await sharp(plateSvg)
    .composite([{ input: m.buf, gravity: "center" }])
    .png()
    .toBuffer();

  await sharp({ create: { width: S, height: S, channels: 4, background: GLOW } })
    .composite([
      { input: plateMark, gravity: "center" },
    ])
    .png()
    .toFile(`${OUT}/splash.png`);

  const mDark = await markAt(660);
  await (await canvas(S, { glowOpacity: 0.16 }))
    .composite([{ input: mDark.buf, gravity: "center" }])
    .png()
    .toFile(`${OUT}/splash-dark.png`);
}

const sizes = {
  "icon.png": await sharp(`${OUT}/icon.png`).metadata(),
  "icon-foreground.png": await sharp(`${OUT}/icon-foreground.png`).metadata(),
  "splash.png": await sharp(`${OUT}/splash.png`).metadata(),
};
await writeFile(
  `${OUT}/.mark-box.json`,
  JSON.stringify({ source: LOGO, mark: box, sizes: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, `${v.width}x${v.height}`])) }, null, 2) + "\n",
);
console.log("mark box", box);
console.log("wrote assets/:", Object.keys(sizes).join(", "));
