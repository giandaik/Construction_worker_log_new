/**
 * The work-log sheet — one renderer for the on-demand export, the email
 * attachment and, later, the archived record.
 *
 * Layout follows the Sitely design system's document layer (design/tokens.css →
 * lib/pdf/tokens.generated.ts): A4, 15mm margin, hazard strip, brand header,
 * five quick-info cards, yellow-ruled sections, tables with a total row, fixed
 * evidence heights for photos and signatures, and a footer that identifies the
 * exhibit on every page.
 *
 * Two rules this file exists to keep:
 *   1. No colour, size or measure is written here. They come from tokens.
 *   2. No date is rendered from the device locale; every value is formatted in
 *      the site timezone with an explicit label.
 */
import { jsPDF } from 'jspdf';

import fira400 from '../../app/fonts/fira-sans-400.js';
import fira600 from '../../app/fonts/fira-sans-600.js';
import fira700 from '../../app/fonts/fira-sans-700.js';

import { pdfColors, pdfMeasures, type Rgb } from './tokens.generated';

/* ------------------------------------------------------------------ types */

export interface SheetPersonnel {
  role: string;
  count: number;
  workDetails?: string;
}

export interface SheetEquipment {
  type: string;
  count: number;
  hours?: number;
}

export interface SheetMaterial {
  name: string;
  quantity: number;
  unit: string;
}

export interface SheetSignature {
  data: string;
  signedBy?: string;
  signedAt: string | Date;
  role?: string;
  projectRole?: string;
}

/** Everything the sheet needs; a superset of the app's WorkLog. */
export interface SheetWorkLog {
  _id?: string | { toString(): string };
  date: string | Date;
  project?: string | { toString(): string };
  projectName?: string;
  projectLocation?: string;
  author?: string | { toString(): string };
  authorName?: string;
  weather?: string;
  temperature?: number;
  workDescription: string;
  status?: string;
  personnel?: SheetPersonnel[];
  equipment?: SheetEquipment[];
  materials?: SheetMaterial[];
  notes?: string;
  signatures?: SheetSignature[];
  images?: string[];
  rejectionComment?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface SheetOptions {
  /** IANA zone the record is printed in. Defaults to the site's zone. */
  timeZone?: string;
  /** Overrides "now" for the export stamp; used by tests. */
  now?: Date;
}

/* ---------------------------------------------------------------- format */

const DEFAULT_TIME_ZONE = 'Europe/Athens';

/** dd/mm/yyyy in a fixed zone — never the device locale. */
export function formatSheetDate(value: string | Date, timeZone = DEFAULT_TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}

/** dd/mm/yyyy, HH:MM in a fixed zone. */
export function formatSheetDateTime(value: string | Date, timeZone = DEFAULT_TIME_ZONE): string {
  const date = toDate(value);
  if (!date) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}`;
}

export function formatSheetZone(value: string | Date, timeZone = DEFAULT_TIME_ZONE): string {
  const date = toDate(value) ?? new Date();
  const part = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value;
  return part ?? timeZone;
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* ----------------------------------------------------------------- states */

type BadgeSpec = { label: string; ink: Rgb; soft: Rgb };

/**
 * The record's states, not the code's: FORM_STATUS carries pending/signed/
 * completed, and "signed" there means the contractor has signed and the owner
 * has not. The badge says what the paper actually is.
 */
const BADGES: Record<string, BadgeSpec> = {
  draft: { label: 'Draft', ink: pdfColors.neutralInk, soft: pdfColors.neutralSoft },
  pending: { label: 'Draft', ink: pdfColors.neutralInk, soft: pdfColors.neutralSoft },
  signed: { label: 'Awaiting signature', ink: pdfColors.amberInk, soft: pdfColors.amberSoft },
  completed: { label: 'Signed', ink: pdfColors.greenInk, soft: pdfColors.greenSoft },
  rejected: { label: 'Rejected', ink: pdfColors.redInk, soft: pdfColors.redSoft },
};

function badgeFor(status?: string): BadgeSpec {
  return BADGES[(status ?? '').toLowerCase()] ?? BADGES.pending;
}

/* ------------------------------------------------------------------ type */

/** Print scale. The screen scale is px; paper is pt, at 1pt = 0.3528mm. */
const TYPE = {
  display: 21,      // WORK LOG
  title: 13,        // project name
  section: 9.5,     // section headings
  body: 9,          // prose, table cells
  value: 9,         // quick-info values
  label: 5.8,       // uppercase labels
  caption: 6.4,     // captions, timestamps
  footer: 6.2,
} as const;

const LINE = {
  body: 4.3,        // mm between baselines of 9pt prose
  title: 5.2,
} as const;

const GUTTER = 3;              // mm between quick-info cards
const CELL_PAD_X = 3;          // mm inside a table cell
const CONTENT_TOP = 6;         // mm below the hazard strip
const CONTENT_BOTTOM = 277;    // mm; the footer sits at 281
const FOOTER_Y = 284;

/* ------------------------------------------------------------------ sheet */

class Sheet {
  readonly doc: jsPDF;
  readonly pageW = pdfMeasures.pageWidthMm;
  readonly pageH = 297;
  readonly left = pdfMeasures.marginMm;
  readonly right = this.pageW - pdfMeasures.marginMm;
  readonly contentW = this.right - this.left;

  y = CONTENT_TOP;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  /* ---- primitives ---- */

  ink(color: Rgb) {
    this.doc.setTextColor(color[0], color[1], color[2]);
    return this;
  }

  fill(color: Rgb) {
    this.doc.setFillColor(color[0], color[1], color[2]);
    return this;
  }

  stroke(color: Rgb, width = 0.2) {
    this.doc.setDrawColor(color[0], color[1], color[2]);
    this.doc.setLineWidth(width);
    return this;
  }

  /** 400 body · 600 emphasis · 700 display. */
  font(weight: 400 | 600 | 700, sizePt: number) {
    this.doc.setFont(weight === 600 ? 'FiraSansSemi' : 'FiraSans', weight === 700 ? 'bold' : 'normal');
    this.doc.setFontSize(sizePt);
    return this;
  }

  width(text: string, track = 0): number {
    return this.doc.getTextWidth(text) + track * Math.max(0, text.length - 1);
  }

  text(
    text: string,
    x: number,
    y: number,
    opts: { align?: 'left' | 'right' | 'center'; track?: number } = {},
  ) {
    const track = opts.track ?? 0;
    const options = track ? { charSpace: track } : undefined;
    if (opts.align === 'right') this.doc.text(text, x, y, { ...options, align: 'right' });
    else if (opts.align === 'center') this.doc.text(text, x, y, { ...options, align: 'center' });
    else this.doc.text(text, x, y, options);
    return this;
  }

  label(text: string, x: number, y: number, opts: { align?: 'left' | 'right'; color?: Rgb; size?: number } = {}) {
    this.font(600, opts.size ?? TYPE.label).ink(opts.color ?? pdfColors.inkSoft);
    return this.text(text.toUpperCase(), x, y, { align: opts.align, track: (opts.size ?? TYPE.label) * 0.055 });
  }

  hairline(y: number, opts: { color?: Rgb; width?: number; x1?: number; x2?: number } = {}) {
    this.stroke(opts.color ?? pdfColors.rule, opts.width ?? 0.2);
    this.doc.line(opts.x1 ?? this.left, y, opts.x2 ?? this.right, y);
    return this;
  }

  /* ---- page mechanics ---- */

  hazard() {
    const h = pdfMeasures.hazardMm;
    this.fill(pdfColors.hazardDark).doc.rect(0, 0, this.pageW, h, 'F');
    this.fill(pdfColors.accent);
    const step = 8;
    const w = 4;
    for (let x = -h - step; x < this.pageW + step; x += step) {
      // A 45° stripe, drawn as two triangles so it reads as one bar.
      this.doc.triangle(x, 0, x + w, 0, x + w - h, h, 'F');
      this.doc.triangle(x, 0, x + w - h, h, x - h, h, 'F');
    }
    return this;
  }

  /** Start a continuation page: the strip stays, the brand block does not. */
  newPage(continuation: { title: string; meta: string }) {
    this.doc.addPage();
    this.hazard();
    this.font(400, TYPE.caption).ink(pdfColors.inkSoft);
    this.text(continuation.title, this.left, 10.5);
    this.text(continuation.meta, this.right, 10.5, { align: 'right' });
    this.hairline(13);
    this.y = 20;
  }

  /** Fail-safe page break: keeps a block of `height` mm on one page. */
  ensure(height: number, onBreak: () => void) {
    if (this.y + height <= CONTENT_BOTTOM) return;
    onBreak();
  }

  /* ---- blocks ---- */

  /**
   * Section heading. `keepWith` is the height of the block that must follow it:
   * a heading never strands itself at the foot of a page.
   *
   * `chip` carries the section's aggregate ("7 crew", "11 h"). A total belongs
   * beside the title it totals, not in a band across the bottom of the table.
   */
  heading(title: string, keepWith = 12, chip?: string) {
    this.ensure(10 + keepWith, () => this.breakSection());
    this.y += 3.6;
    this.fill(pdfColors.accent).doc.rect(this.left, this.y - 3.3, 1.2, 4.2, 'F');

    const label = title.toUpperCase();
    const track = TYPE.section * 0.03;
    this.font(700, TYPE.section);
    const fits = !chip || this.left + 3.2 + this.width(label, track) + 6 < this.right - this.chipWidth(chip);
    if (chip && fits) this.chipAt(chip, this.right, this.y);

    this.ink(pdfColors.ink);
    this.text(label, this.left + 3.2, this.y, { track });
    this.y += 2.4;
    this.hairline(this.y);
    this.y += 4.8;
  }

  /* ---- chips ----
     The design system's accent chip: a yellow pill whose text sits on the same
     baseline as the label it belongs to. Baseline, not box centre — a pill
     centred on a guess floats above the line it is meant to sit in. */

  private chipMetrics(text: string) {
    const size = 5.4;
    const track = size * 0.05;
    this.font(600, size);
    const textW = this.width(text, track);
    const padX = 2.2;
    const h = 4.6;
    // Distance from the text baseline down to the pill's optical centre:
    // half the cap height of a 5.4pt face.
    const capHalf = (size * 0.72) / 2 / 2.8346;
    return { text, track, textW, padX, w: textW + padX * 2, h, top: -h / 2 - capHalf };
  }

  chipWidth(text: string): number {
    return this.chipMetrics(text).w;
  }

  /** Draws a chip whose right edge is at `xRight` and whose text baseline is `baseline`. */
  chipAt(text: string, xRight: number, baseline: number) {
    const m = this.chipMetrics(text);
    this.fill(pdfColors.accent);
    this.doc.roundedRect(xRight - m.w, baseline + m.top, m.w, m.h, m.h / 2, m.h / 2, 'F');
    this.ink(pdfColors.onAccent);
    this.text(m.text, xRight - m.padX, baseline, { align: 'right', track: m.track });
    return m.w;
  }

  /** Truncates a single line to `maxW`, with an ellipsis. */
  fitLine(text: string, maxW: number): string {
    if (this.width(text) <= maxW) return text;
    let cut = text;
    while (cut.length > 1 && this.width(`${cut}…`) > maxW) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  }

  /** How a section breaks when it runs out of page. */
  breakSection() {
    this.onBreak();
  }

  /** Set by the caller so a section heading can start a fresh page. */
  onBreak: () => void = () => {};

  /** Rounded status pill; `top` is the box's top edge, right-aligned. */
  badgeAt(spec: BadgeSpec, xRight: number, top: number) {
    const w = this.badgeWidth(spec);
    return this.badgeAtLeft(spec, xRight - w, top);
  }

  /** Width of the status pill, without drawing it. */
  badgeWidth(spec: BadgeSpec): number {
    this.font(600, 6.4);
    return this.width(spec.label.toUpperCase(), 6.4 * 0.055) + 6;
  }

  /** Status pill anchored by its left edge — sits beside the project name. */
  badgeAtLeft(spec: BadgeSpec, x: number, top: number) {
    const text = spec.label.toUpperCase();
    const track = 6.4 * 0.055;
    const w = this.badgeWidth(spec);
    const h = 6;
    this.fill(spec.soft).doc.roundedRect(x, top, w, h, 1.5, 1.5, 'F');
    this.ink(spec.ink);
    this.font(600, 6.4);
    this.text(text, x + 3, top + 4.2, { track });
    return this;
  }

  quickCards(items: Array<{ label: string; value: string }>) {
    const count = items.length;
    const cardW = (this.contentW - GUTTER * (count - 1)) / count;
    const h = 16.5;
    this.ensure(h + 4, () => this.onBreak());

    const top = this.y;
    items.forEach((item, index) => {
      const x = this.left + index * (cardW + GUTTER);
      this.fill(pdfColors.sunken).stroke(pdfColors.rule, 0.2);
      this.doc.roundedRect(x, top, cardW, h, pdfMeasures.cardRadiusMm, pdfMeasures.cardRadiusMm, 'FD');

      this.label(item.label, x + 2.6, top + 5.2, { size: 5.4 });

      const value = item.value?.trim() || '—';
      this.font(600, TYPE.value).ink(pdfColors.ink);
      const inner = cardW - 5.2;
      const lines = this.doc.splitTextToSize(value, inner) as string[];
      const shown = lines.slice(0, 2);
      shown.forEach((line, lineIndex) => {
        this.text(line, x + 2.6, top + 11.2 + lineIndex * 4.1);
      });
    });
    this.y = top + h;
    return this;
  }

  prose(text: string, opts: { ground?: Rgb; border?: Rgb; accentBar?: Rgb } = {}) {
    const padX = 4;
    const padY = 4.4;
    this.font(400, TYPE.body);
    const lines = this.doc.splitTextToSize(text, this.contentW - padX * 2 - 1.6) as string[];
    const blockH = padY * 2 + lines.length * LINE.body;

    if (blockH < CONTENT_BOTTOM - this.y) {
      this.drawProseBlock(lines, blockH, padX, padY, opts);
      return;
    }

    // Taller than a page: split across pages, keeping the ground.
    let index = 0;
    while (index < lines.length) {
      const room = CONTENT_BOTTOM - this.y;
      const fit = Math.max(1, Math.floor((room - padY * 2) / LINE.body));
      const chunk = lines.slice(index, index + fit);
      this.drawProseBlock(chunk, padY * 2 + chunk.length * LINE.body, padX, padY, opts);
      index += chunk.length;
      if (index < lines.length) this.onBreak();
    }
  }

  private drawProseBlock(
    lines: string[],
    blockH: number,
    padX: number,
    padY: number,
    opts: { ground?: Rgb; border?: Rgb; accentBar?: Rgb },
  ) {
    const top = this.y;
    this.fill(opts.ground ?? pdfColors.paperWarm)
      .stroke(opts.border ?? pdfColors.rule, 0.2)
      .doc.roundedRect(this.left, top, this.contentW, blockH, 2, 2, 'FD');
    if (opts.accentBar) {
      this.fill(opts.accentBar).doc.rect(this.left, top + 2, 1, blockH - 4, 'F');
    }
    this.font(400, TYPE.body).ink(pdfColors.ink);
    lines.forEach((line, index) => {
      this.text(line, this.left + padX + 1.6, top + padY + 3.2 + index * LINE.body);
    });
    this.y = top + blockH + 4;
  }

  table(config: {
    columns: Array<{ label: string; width: number; align?: 'left' | 'right' }>;
    rows: string[][];
    emptyLabel?: string;
  }) {
    const headerH = 6.4;
    const rowH = 7;

    const drawHeader = () => {
      this.fill(pdfColors.sunken).doc.rect(this.left, this.y, this.contentW, headerH, 'F');
      let x = this.left;
      config.columns.forEach((column) => {
        const isRight = column.align === 'right';
        this.label(column.label, isRight ? x + column.width - CELL_PAD_X : x + CELL_PAD_X, this.y + 4.3, {
          align: isRight ? 'right' : 'left',
          size: 5.4,
        });
        x += column.width;
      });
      this.y += headerH;
    };

    const drawRow = (cells: string[], right?: boolean) => {
      let x = this.left;
      cells.forEach((cell, index) => {
        const column = config.columns[index];
        const isRight = (column?.align ?? 'left') === 'right';
        this.font(right ? 600 : 400, TYPE.body).ink(pdfColors.ink);
        const lines = this.doc.splitTextToSize(cell || '—', column.width - CELL_PAD_X * 2) as string[];
        lines.slice(0, 1).forEach((line) => {
          this.text(line, isRight ? x + column.width - CELL_PAD_X : x + CELL_PAD_X, this.y + 4.6, {
            align: isRight ? 'right' : 'left',
          });
        });
        x += column.width;
      });
      this.y += rowH;
      this.hairline(this.y, { color: pdfColors.ruleSoft, width: 0.15 });
    };

    if (!config.rows.length) {
      this.font(400, TYPE.body).ink(pdfColors.inkSoft);
      this.text(config.emptyLabel ?? 'Nothing recorded for this day.', this.left, this.y + 4);
      this.y += rowH;
      return;
    }

    // Header stays with at least one row.
    this.ensure(headerH + rowH, () => this.onBreak());
    drawHeader();

    config.rows.forEach((cells) => {
      this.ensure(rowH + 1, () => {
        this.onBreak();
        drawHeader();
      });
      drawRow(cells);
    });
    this.y += 3.2;
  }

  async photos(sources: string[], load: (src: string) => Promise<string | null>) {
    const frameW = (this.contentW - 6) / 2;
    const frameH = 58;
    const rowH = frameH + 7;

    for (let index = 0; index < sources.length; index += 2) {
      this.ensure(rowH, () => this.onBreak());
      const rowTop = this.y;
      const pair = sources.slice(index, index + 2);

      for (let slot = 0; slot < pair.length; slot += 1) {
        const x = this.left + slot * (frameW + 6);
        this.fill(pdfColors.paperWarm).stroke(pdfColors.rule, 0.2);
        this.doc.rect(x, rowTop, frameW, frameH, 'FD');

        const dataUrl = await load(pair[slot]);
        if (dataUrl) {
          try {
            const props = this.doc.getImageProperties(dataUrl);
            const scale = Math.min((frameW - 3) / props.width, (frameH - 3) / props.height);
            const drawW = props.width * scale;
            const drawH = props.height * scale;
            const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
            this.doc.addImage(
              dataUrl, format,
              x + (frameW - drawW) / 2, rowTop + (frameH - drawH) / 2,
              drawW, drawH,
            );
          } catch {
            this.font(400, TYPE.caption).ink(pdfColors.redInk);
            this.text('Photo could not be embedded', x + frameW / 2, rowTop + frameH / 2, { align: 'center' });
          }
        } else {
          this.font(400, TYPE.caption).ink(pdfColors.inkSoft);
          this.text('Photo unavailable at export', x + frameW / 2, rowTop + frameH / 2, { align: 'center' });
        }

        this.font(400, TYPE.caption).ink(pdfColors.inkSoft);
        this.text(`Photo ${String(index + slot + 1).padStart(2, '0')}`, x, rowTop + frameH + 4);
      }
      this.y = rowTop + rowH;
    }
    this.y += 1;
  }

  signatures(signatures: SheetSignature[], timeZone: string, locked: boolean) {
    const boxW = (this.contentW - 6) / 2;
    const boxH = 40;
    const strokeH = 15;

    for (let index = 0; index < signatures.length; index += 2) {
      this.ensure(boxH + 12, () => this.onBreak());
      const top = this.y;
      const pair = signatures.slice(index, index + 2);

      pair.forEach((signature, slot) => {
        const x = this.left + slot * (boxW + 6);
        const party = partyLabel(signature);

        this.label(party, x, top + 3.6);
        this.font(600, 10).ink(pdfColors.ink);
        this.text(signature.signedBy?.trim() || 'Unsigned', x, top + 9.4);

        // The stroke area is a fixed height so a photo of a signature never
        // moves the sheet.
        const strokeTop = top + 12;
        this.stroke(pdfColors.rule, 0.2).doc.rect(x, strokeTop, boxW, strokeH, 'S');
        if (signature.data) {
          try {
            const props = this.doc.getImageProperties(signature.data);
            const scale = Math.min((boxW - 2) / props.width, (strokeH - 2) / props.height);
            this.doc.addImage(
              signature.data, signature.data.includes('image/jpeg') ? 'JPEG' : 'PNG',
              x + (boxW - props.width * scale) / 2,
              strokeTop + (strokeH - props.height * scale) / 2,
              props.width * scale, props.height * scale,
            );
          } catch {
            this.font(400, TYPE.caption).ink(pdfColors.redInk);
            this.text('Signature could not be embedded', x + boxW / 2, strokeTop + strokeH / 2, { align: 'center' });
          }
        }
        this.hairline(strokeTop + strokeH, { color: pdfColors.ink, width: 0.3, x1: x, x2: x + boxW });

        this.font(400, TYPE.caption).ink(pdfColors.inkSoft);
        this.text(`Signed ${formatSheetDateTime(signature.signedAt, timeZone)}`, x, strokeTop + strokeH + 5);
      });

      this.y = top + boxH + 2;
    }

    if (locked) {
      this.ensure(14, () => this.onBreak());
      this.y += 2;
      const y = this.y;
      this.lockGlyph(this.left, y - 2.4);
      this.font(600, TYPE.caption).ink(pdfColors.inkSoft);
      this.text(
        'Record locked after signing. The file cannot be edited or deleted.',
        this.left + 5,
        y,
      );
      this.y += 6;
    }
    this.y += 3;
  }

  private lockGlyph(x: number, y: number) {
    this.stroke(pdfColors.inkSoft, 0.25);
    this.doc.circle(x + 1.3, y + 0.9, 0.9, 'S');
    this.fill(pdfColors.inkSoft);
    this.doc.rect(x + 0.15, y + 1.5, 2.3, 1.9, 'F');
  }

  /** Stamps every page: identity on the left, page count on the right. */
  finalize(identity: string) {
    const total = this.doc.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
      this.doc.setPage(page);
      this.hairline(FOOTER_Y - 4, { color: pdfColors.ruleSoft, width: 0.15 });
      this.font(400, TYPE.footer).ink(pdfColors.inkSoft);
      this.text('Generated by Sitely', this.left, FOOTER_Y);
      this.text(identity, this.pageW / 2, FOOTER_Y, { align: 'center' });
      this.text(`${page} / ${total}`, this.right, FOOTER_Y, { align: 'right' });
    }
    this.doc.setPage(1);
    return total;
  }
}

function partyLabel(signature: SheetSignature): string {
  const role = (signature.projectRole ?? signature.role ?? '').toLowerCase();
  if (role.startsWith('contract') || role === 'engineer') return 'Contractor';
  if (role.startsWith('owner') || role === 'client') return 'Owner';
  if (role === 'supervisor') return 'Supervisor';
  return signature.role?.trim() ? signature.role : 'Signed by';
}

/* --------------------------------------------------------------- renderer */

export async function renderWorkLogSheet(
  workLog: SheetWorkLog,
  options: SheetOptions = {},
): Promise<jsPDF> {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const now = options.now ?? new Date();

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('FiraSans-Regular.ttf', fira400);
  doc.addFileToVFS('FiraSans-SemiBold.ttf', fira600);
  doc.addFileToVFS('FiraSans-Bold.ttf', fira700);
  doc.addFont('FiraSans-Regular.ttf', 'FiraSans', 'normal');
  doc.addFont('FiraSans-SemiBold.ttf', 'FiraSansSemi', 'normal');
  doc.addFont('FiraSans-Bold.ttf', 'FiraSans', 'bold');

  const sheet = new Sheet(doc);
  const projectName = workLog.projectName?.trim() || String(workLog.project ?? '').trim() || 'Untitled project';
  const dateLabel = formatSheetDate(workLog.date, timeZone);
  const continuation = { title: 'WORK LOG', meta: `${projectName} · ${dateLabel}` };
  sheet.onBreak = () => sheet.newPage(continuation);

  /* ---- page 1 header ---- */
  sheet.hazard();

  const brandTop = 8.4;
  drawBrandMark(sheet, sheet.left, brandTop);
  sheet.font(700, 14).ink(pdfColors.ink);
  sheet.text('sitely', sheet.left + 5.6, brandTop + 2.2, { track: 0.2 });

  sheet.font(700, TYPE.display).ink(pdfColors.ink);
  sheet.text('WORK LOG', sheet.right, brandTop + 1.6, { align: 'right', track: TYPE.display * 0.02 });
  sheet.font(400, TYPE.caption).ink(pdfColors.inkSoft);
  sheet.text('Daily site record — signed, synced, on file.', sheet.right, brandTop + 7.2, { align: 'right' });

  sheet.y = 20.5;
  sheet.hairline(sheet.y);

  /* ---- meta row ---- */
  const metaTop = sheet.y + 4;
  const status = badgeFor(workLog.status);
  const locked = status.label === 'Signed';

  const dateX = sheet.left + sheet.contentW * 0.55;
  const nameSize = TYPE.title + 0.5;
  const nameBaseline = metaTop + 9.6;

  sheet.label('Project', sheet.left, metaTop + 2);

  // The status pill belongs to the record, and it reads as a property of the
  // project name: it follows the name on the same baseline.
  const pillW = sheet.badgeWidth(status);
  sheet.font(600, nameSize).ink(pdfColors.ink);
  const nameRoom = dateX - sheet.left - 8 - (pillW + 4);
  const nameFitted = sheet.fitLine(projectName, nameRoom);
  sheet.text(nameFitted, sheet.left, nameBaseline);
  const pillX = sheet.left + sheet.width(nameFitted) + 4;
  if (pillX + pillW < dateX - 2) sheet.badgeAtLeft(status, pillX, nameBaseline - 5.6);

  if (workLog.projectLocation) {
    sheet.font(400, TYPE.caption).ink(pdfColors.inkSoft);
    sheet.text(workLog.projectLocation, sheet.left, metaTop + 14.4);
  }

  sheet.label('Date', dateX, metaTop + 2);
  sheet.font(600, TYPE.title + 0.5).ink(pdfColors.ink);
  sheet.text(dateLabel, dateX, metaTop + 9.6);

  sheet.font(400, TYPE.caption).ink(pdfColors.inkSoft);
  const createdLabel = workLog.createdAt
    ? `Created ${formatSheetDateTime(workLog.createdAt, timeZone)}`
    : 'Capture time not recorded';
  sheet.text(createdLabel, sheet.right, metaTop + 6.4, { align: 'right' });
  sheet.text(`Site time ${formatSheetZone(now, timeZone)}`, sheet.right, metaTop + 10.9, { align: 'right' });

  sheet.y = metaTop + 18;

  /* ---- quick facts ----
     A card with nothing in it reads as a form that was not filled in. The cards
     that have no value are dropped and the rest share the width. */
  const quickFacts = [
    { label: 'Date', value: dateLabel },
    { label: 'Project', value: projectName },
    { label: 'Author', value: workLog.authorName?.trim() || String(workLog.author ?? '').trim() },
    { label: 'Weather', value: workLog.weather?.trim() ?? '' },
    { label: 'Temperature', value: typeof workLog.temperature === 'number' ? `${workLog.temperature}°C` : '' },
  ];
  const factsWithValue = quickFacts.filter((fact) => fact.value.trim().length > 0);
  sheet.quickCards(factsWithValue.length >= 2 ? factsWithValue : quickFacts.slice(0, 2));
  sheet.y += 3.2;

  /* ---- returned log ---- */
  if (workLog.rejectionComment?.trim()) {
    sheet.ensure(18, () => sheet.onBreak());
    sheet.heading('Returned by the owner', 20);
    sheet.prose(workLog.rejectionComment.trim(), {
      ground: pdfColors.redSoft,
      border: pdfColors.redSoft,
      accentBar: pdfColors.redInk,
    });
  }

  /* ---- work description ---- */
  sheet.heading('Work description', 18);
  if (workLog.workDescription?.trim()) {
    sheet.font(400, TYPE.body).ink(pdfColors.ink);
    sheet.prose(workLog.workDescription.trim());
  } else {
    sheet.font(400, TYPE.body).ink(pdfColors.inkSoft);
    sheet.text('No description recorded.', sheet.left, sheet.y + 1);
    sheet.y += 6;
  }

  /* ---- personnel ---- */
  if (workLog.personnel?.length) {
    const totalPeople = workLog.personnel.reduce((sum, row) => sum + (row.count || 0), 0);
    sheet.heading('Personnel', 16, `${totalPeople} crew`);
    sheet.table({
      columns: [
        { label: 'Role', width: 55 },
        { label: 'Count', width: 18, align: 'right' },
        { label: 'Work details', width: 107 },
      ],
      rows: workLog.personnel.map((row) => [
        row.role,
        String(row.count ?? 0),
        row.workDetails?.trim() || '—',
      ]),
    });
  }

  /* ---- equipment ---- */
  if (workLog.equipment?.length) {
    const totalHours = workLog.equipment.reduce((sum, row) => sum + (row.hours || 0), 0);
    sheet.heading('Equipment', 16, totalHours > 0 ? `${totalHours} h` : `${workLog.equipment.length} items`);
    sheet.table({
      columns: [
        { label: 'Type', width: 118 },
        { label: 'Count', width: 34, align: 'right' },
        { label: 'Hours', width: 28, align: 'right' },
      ],
      rows: workLog.equipment.map((row) => [
        row.type,
        String(row.count ?? 0),
        typeof row.hours === 'number' ? String(row.hours) : '—',
      ]),
      // No total row: the section heading already carries the aggregate
      // ("11 h"), which is where this file's design puts totals.
    });
  }

  /* ---- materials ----
     A count, not a total: cubic metres and tonnes do not add up, so the chip
     says how many lines were logged and nothing more. */
  if (workLog.materials?.length) {
    const lines = workLog.materials.length;
    sheet.heading('Materials', 16, `${lines} ${lines === 1 ? 'item' : 'items'}`);
    sheet.table({
      columns: [
        { label: 'Material', width: 132 },
        { label: 'Quantity', width: 48, align: 'right' },
      ],
      rows: workLog.materials.map((row) => [
        row.name,
        `${formatQuantity(row.quantity)} ${row.unit ?? ''}`.trim(),
      ]),
    });
  }

  /* ---- notes ---- */
  if (workLog.notes?.trim()) {
    sheet.heading('Notes', 14);
    sheet.prose(workLog.notes.trim());
  }

  /* ---- photos ---- */
  if (workLog.images?.length) {
    sheet.heading('Photos', 68);
    await sheet.photos(workLog.images, async (src) => {
      try {
        return src.startsWith('data:') ? src : await fetchAsDataUrl(src);
      } catch {
        return null;
      }
    });
  }

  /* ---- signatures ---- */
  if (workLog.signatures?.length) {
    sheet.heading('Signatures', 48);
    sheet.signatures(workLog.signatures, timeZone, locked);
  }

  /* ---- footer identity ---- */
  const id = workLog._id ? String(workLog._id).slice(-8) : 'unsaved';
  const identity = `log ${id} · exported ${formatSheetDateTime(now, timeZone)} ${formatSheetZone(now, timeZone)}`;
  sheet.finalize(identity);

  return doc;
}

function drawBrandMark(sheet: Sheet, x: number, y: number) {
  // The house glyph: roof, body, door — same geometry as the app's logo.
  sheet.stroke(pdfColors.ink, 0.45);
  sheet.doc.line(x, y + 2.4, x + 2.1, y);
  sheet.doc.line(x + 2.1, y, x + 4.2, y + 2.4);
  sheet.doc.line(x + 0.55, y + 2.1, x + 0.55, y + 4.6);
  sheet.doc.line(x + 3.65, y + 2.1, x + 3.65, y + 4.6);
  sheet.doc.line(x + 0.55, y + 4.6, x + 3.65, y + 4.6);
  sheet.stroke(pdfColors.accent, 0.5);
  sheet.doc.line(x + 1.7, y + 4.6, x + 1.7, y + 3.1);
  sheet.doc.line(x + 2.5, y + 4.6, x + 2.5, y + 3.1);
}

function formatQuantity(quantity: number): string {
  if (typeof quantity !== 'number' || Number.isNaN(quantity)) return String(quantity ?? '—');
  if (Number.isInteger(quantity)) return String(quantity);
  // Greek convention: comma decimal, no thousands separator confusion.
  return quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const blob = await res.blob();

  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const contentType = blob.type || res.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}
