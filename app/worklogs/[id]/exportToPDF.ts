/**
 * Work-log PDF export.
 *
 * This file is the entry point only: the on-demand export, the email
 * attachment and the archive all funnel into one renderer
 * (`lib/pdf/worklogSheet.ts`), so the record cannot differ depending on who
 * asked for it. Layout, colour and type come from the design system's document
 * layer (`design/tokens.css` → `lib/pdf/tokens.generated.ts`).
 */
import type { WorkLogWithDetails } from '@/lib/repositories/WorkLogRepository';
import { renderWorkLogSheet, type SheetWorkLog } from '@/lib/pdf/worklogSheet';

interface Personnel {
    role: string;
    count: number;
    workDetails?: string;
}

interface Equipment {
    type: string;
    count: number;
    // Optional: rows replayed from the offline queue may carry no hours value.
    hours?: number;
}

interface Material {
    name: string;
    quantity: number;
    unit: string;
}

interface Signature {
    data: string;
    signedBy: string;
    signedAt: string | Date;
    role?: string;
    projectRole?: string;
}

interface WorkLog {
    _id?: string | { toString(): string };
    date: string | Date;
    project: string | { toString(): string };
    projectName?: string;
    projectLocation?: string;
    author: string | { toString(): string };
    authorName?: string;
    weather?: string;
    temperature?: number;
    workDescription: string;
    status?: string;
    personnel?: Personnel[];
    equipment?: Equipment[];
    materials?: Material[];
    notes?: string;
    signatures?: Signature[];
    images?: string[];
    rejectionComment?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

export function getWorkLogPdfFilename(workLog: WorkLog): string {
    return `WorkLog-${new Date(workLog.date).toISOString().split("T")[0]}.pdf`;
}

export interface WorkLogPdfAttachment {
    filename: string;
    content: Buffer;
    contentType: 'application/pdf';
}

export async function createWorkLogPdfAttachment(
    workLog: WorkLogWithDetails
): Promise<WorkLogPdfAttachment | undefined> {
    try {
        const content = await exportToPDFBuffer(workLog);
        return {
            filename: getWorkLogPdfFilename(workLog),
            content,
            contentType: 'application/pdf',
        };
    } catch (error) {
        console.error('Error generating PDF attachment:', error);
        return undefined;
    }
}

/** Browser path: build the sheet and hand it to the download dialog. */
export async function exportToPDF(workLog: WorkLog) {
    const doc = await renderWorkLogSheet(workLog as SheetWorkLog);
    doc.save(getWorkLogPdfFilename(workLog));
}

/** Server path: the same sheet, returned as bytes for an email attachment. */
export async function exportToPDFBuffer(workLog: WorkLogWithDetails | WorkLog): Promise<Buffer> {
    const doc = await renderWorkLogSheet(workLog as SheetWorkLog);
    return Buffer.from(doc.output('arraybuffer'));
}
