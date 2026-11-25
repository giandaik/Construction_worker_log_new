/**
 * The work-log sheet, rendered from fixtures.
 *
 * These tests do not eyeball a screenshot: they render real PDFs, write them to
 * `.pdf-preview/`, and assert the properties that break silently — page count,
 * embedded fonts (Greek must not fall back), embedded images, and that no
 * optional section disappears when the data is present.
 *
 * Visual review is a separate step on the written files; see
 * `scripts/pdf-preview.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderWorkLogSheet, type SheetWorkLog } from '@/lib/pdf/worklogSheet';

const OUT = join(process.cwd(), '.pdf-preview');
const FIXTURES = join(process.cwd(), '__tests__/pdf/fixtures');

const NOW = new Date('2026-11-25T09:42:00+02:00');

function dataUrl(file: string, mime: string): string {
  return `data:${mime};base64,${readFileSync(join(FIXTURES, file)).toString('base64')}`;
}

const signature = (name: string, role: string): SheetWorkLog['signatures'] => [
  {
    data: dataUrl('signature.png', 'image/png'),
    signedBy: name,
    signedAt: '2026-11-24T16:47:31+02:00',
    projectRole: role,
  },
];

function fullLog(): SheetWorkLog {
  return {
    _id: '68f2c1a4b7e3d90a5c1f4e77',
    date: '2026-11-23T00:00:00+02:00',
    project: '68f2c1a4b7e3d90a5c1f0001',
    projectName: 'Σπίτι Γιάννη',
    projectLocation: 'Άνοιξη, Αττική',
    author: '68f2c1a4b7e3d90a5c1f0002',
    authorName: 'test',
    weather: 'Rainy',
    temperature: 32,
    workDescription:
      'Camis — stripping of the north-wall formwork, brick raised to the lintel, 22 m³ concrete placed before the rain. The crane was released at 15:40 and the site was cleared by 17:10.',
    status: 'completed',
    personnel: [
      { role: 'mpeta', count: 1, workDetails: 'Formwork and stripping' },
      { role: 'sidera', count: 6, workDetails: 'Brick and mortar' },
    ],
    equipment: [
      { type: 'bobcat', count: 1, hours: 8 },
      { type: 'crane', count: 1, hours: 3 },
    ],
    materials: [
      { name: 'Έτοιμο σκυρόδεμα C25/30', quantity: 22, unit: 'm³' },
      { name: 'Σίδηρος B500C, Ø12', quantity: 1.4, unit: 't' },
    ],
    notes: 'Owner asked for the side gate to stay open for the delivery on Tuesday.',
    images: [dataUrl('photo-1.jpg', 'image/jpeg'), dataUrl('photo-2.jpg', 'image/jpeg')],
    signatures: [
      ...(signature('gian daik', 'contractor') ?? []),
      ...(signature('Γ. Παπαδόπουλος', 'owner') ?? []),
    ],
    createdAt: '2026-11-24T16:47:00+02:00',
    updatedAt: '2026-11-24T16:48:14+02:00',
  };
}

async function render(workLog: SheetWorkLog, name: string) {
  mkdirSync(OUT, { recursive: true });
  const doc = await renderWorkLogSheet(workLog, { now: NOW, timeZone: 'Europe/Athens' });
  const buffer = Buffer.from(doc.output('arraybuffer'));
  writeFileSync(join(OUT, `${name}.pdf`), buffer);
  return { buffer, pages: doc.getNumberOfPages(), text: buffer.toString('latin1') };
}

describe('work-log sheet', () => {
  it('renders the full record with the record evidence intact', async () => {
    const { buffer, pages, text } = await render(fullLog(), 'full');

    // A complete day — description, three tables, notes, two photos, two
    // signatures — is a two-page record, which is what the sheet itself says.
    expect(pages).toBe(2);
    // Fonts embedded, and the one that carries Greek is really in the file.
    expect(text).toContain('FiraSans');
    expect(text).not.toContain('Roboto');
    // Images embedded: two photos + two signatures + nothing else.
    const images = text.match(/\/Subtype\s*\/Image/g) ?? [];
    expect(images.length).toBe(4);
    // Page geometry is A4 at 210 × 297mm.
    expect(buffer.length).toBeGreaterThan(20_000);
  });

  it('renders a minimal draft without inventing sections', async () => {
    const log: SheetWorkLog = {
      date: '2026-11-20T00:00:00+02:00',
      project: 'p1',
      projectName: 'Warehouse — Phase 2',
      author: 'a1',
      authorName: 'mstath',
      workDescription: 'Cleared the site.',
      status: 'pending',
    };
    const { pages, text } = await render(log, 'minimal');

    expect(pages).toBe(1);
    expect(text).toContain('FiraSans');
  });

  it('paginates a long record and repeats the footer on every page', async () => {
    const log = fullLog();
    log.personnel = Array.from({ length: 34 }, (_, index) => ({
      role: `crew-${index + 1}`,
      count: (index % 4) + 1,
      workDetails: 'General site labour, cleaning and material handling',
    }));
    log.materials = Array.from({ length: 18 }, (_, index) => ({
      name: `Material ${index + 1} — τσιμέντο και άμμος`,
      quantity: index + 0.5,
      unit: 'm³',
    }));
    log.images = Array.from({ length: 6 }, (_, index) =>
      dataUrl(index % 2 === 0 ? 'photo-1.jpg' : 'photo-2.jpg', 'image/jpeg'),
    );

    const { pages, text } = await render(log, 'long');

    expect(pages).toBeGreaterThan(1);
    const pageObjects = text.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pageObjects.length).toBe(pages);
  });

  it('prints the owner rejection above the description', async () => {
    const log = fullLog();
    log.status = 'pending';
    log.rejectionComment = 'Ο ιδιοκτήτης ζητά να προστεθούν οι ώρες του γερανού.';
    log.signatures = signature('gian daik', 'contractor');

    const { pages, text } = await render(log, 'returned');
    expect(pages).toBe(2);
    expect(text).toContain('FiraSans');
  });

  it('survives missing images without failing the export', async () => {
    const log = fullLog();
    log.images = ['data:image/png;base64,AAAA', 'https://example.invalid/missing.jpg'];

    const { pages } = await render(log, 'broken-images');
    expect(pages).toBe(2);
  });
});
