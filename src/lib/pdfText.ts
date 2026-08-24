/**
 * PDF text extraction that preserves column layout.
 *
 * pdf.js returns loose fragments with no notion of line or column. A purchase
 * order is a table: Qty, Unit Price and Amount have to stay separated by runs of
 * spaces, the way `pdftotext -layout` renders them, or the item-row pattern
 * cannot match.
 *
 * Strategy: group fragments by Y (with tolerance, baselines drift by ~1px),
 * order by X within the line, then insert spaces proportional to the horizontal
 * gap between fragments.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

// Resolved from the package itself — no CDN, as the corporate network requires.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const Y_TOLERANCE = 2.5; // pt — fragments within this band are the same line
const CHAR_WIDTH = 4.6; // pt — approximate average character width

export interface PdfLayoutText {
  pages: string[][];
  text: string;
  pageCount: number;
  /** False means a scanned PDF: it needs OCR, not a parser. */
  hasTextLayer: boolean;
}

interface Fragment {
  x: number;
  endX: number;
  text: string;
}

interface Row {
  y: number;
  frags: Fragment[];
}

/** getTextContent() mixes text items with marked-content markers. */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item && 'transform' in item;
}

export async function extractPdfLayoutText(data: ArrayBuffer): Promise<PdfLayoutText> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[][] = [];
  let totalFragments = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    totalFragments += content.items.length;

    const rows: Row[] = [];

    for (const item of content.items) {
      if (!isTextItem(item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const width = item.width || item.str.length * CHAR_WIDTH;

      let row = rows.find((candidate) => Math.abs(candidate.y - y) <= Y_TOLERANCE);
      if (!row) {
        row = { y, frags: [] };
        rows.push(row);
      }
      row.frags.push({ x, endX: x + width, text: item.str });
    }

    // Top to bottom: in a PDF, Y grows upwards.
    rows.sort((a, b) => b.y - a.y);

    pages.push(rows.map((row) => {
      row.frags.sort((a, b) => a.x - b.x);

      let line = '';
      let cursorX: number | null = null;

      for (const frag of row.frags) {
        if (cursorX === null) {
          // Leading indent helps tell header apart from body.
          line = ' '.repeat(Math.max(0, Math.round(frag.x / CHAR_WIDTH)));
        } else {
          const gap = frag.x - cursorX;
          line += ' '.repeat(gap <= 1 ? 0 : Math.max(1, Math.round(gap / CHAR_WIDTH)));
        }
        line += frag.text;
        cursorX = frag.endX;
      }

      return line.replace(/\s+$/, '');
    }));
  }

  return {
    pages,
    text: pages.map((lines) => lines.join('\n')).join('\n'),
    pageCount: pdf.numPages,
    hasTextLayer: totalFragments > 0,
  };
}

/** SHA-256 of the file — used to deduplicate imports. */
export async function fileHash(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
