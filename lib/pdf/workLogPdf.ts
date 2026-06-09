import jsPDF from 'jspdf';
import robotoRegular from "@/app/fonts/Roboto-Regular.js";

import type { WorkLog, Signature } from '@/types/shared';

interface WorkLogWithDetails extends WorkLog {
  projectName?: string;
  projectLocation?: string;
  authorName?: string;
}

const fetchToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
};

const addTextLine = (doc: jsPDF, label: string, value: string | number | undefined, x: number, y: number) => {
  doc.setFontSize(10);
  doc.text(`${label}`, x, y);
  doc.text(`${value ?? 'N/A'}`, x + 50, y);
};

export const generateWorkLogPdfBuffer = async (workLog: WorkLogWithDetails): Promise<Buffer> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto', 'normal');

  const width = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  doc.setFontSize(18);
  doc.text('Signed Work Log', margin, y);
  y += 30;

  doc.setFontSize(11);
  addTextLine(doc, 'Project:', workLog.projectName || workLog.project.toString(), margin, y);
  y += 18;
  addTextLine(doc, 'Location:', workLog.projectLocation, margin, y);
  y += 18;
  addTextLine(doc, 'Author:', workLog.authorName || workLog.author.toString(), margin, y);
  y += 18;
  addTextLine(doc, 'Date:', workLog.date, margin, y);
  y += 18;
  addTextLine(doc, 'Status:', workLog.status, margin, y);
  y += 26;

  doc.setFontSize(12);
  doc.text('Work Description', margin, y);
  y += 16;
  doc.setFontSize(10);
  const descriptionLines = doc.splitTextToSize(workLog.workDescription || 'N/A', width - margin * 2);
  doc.text(descriptionLines, margin, y);
  y += descriptionLines.length * 14 + 20;

  if (workLog.notes) {
    doc.setFontSize(12);
    doc.text('Notes', margin, y);
    y += 16;
    doc.setFontSize(10);
    const notesLines = doc.splitTextToSize(workLog.notes, width - margin * 2);
    doc.text(notesLines, margin, y);
    y += notesLines.length * 14 + 20;
  }

  if (workLog.signatures && workLog.signatures.length > 0) {
    doc.setFontSize(12);
    doc.text('Signatures', margin, y);
    y += 20;

    for (const signature of workLog.signatures) {
      if (y > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(10);
      doc.text(`Signer: ${signature.signedBy}`, margin, y);
      y += 14;
      doc.text(`Role: ${signature.role ?? 'N/A'}`, margin, y);
      y += 14;
      doc.text(`Signed At: ${new Date(signature.signedAt).toLocaleString()}`, margin, y);
      y += 14;

      if (signature.data) {
        const imageDataUrl = signature.data.startsWith('data:')
          ? signature.data
          : await fetchToDataUrl(signature.data);

        if (imageDataUrl) {
          const imageHeight = 60;
          const imageWidth = 120;
          if (y + imageHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
          }
          try {
            doc.addImage(imageDataUrl, 'PNG', margin, y, imageWidth, imageHeight);
          } catch {
            doc.text('(Signature image could not be rendered)', margin, y);
          }
          y += imageHeight + 20;
        }
      }

      y += 10;
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
};
