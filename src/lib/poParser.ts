/**
 * Deterministic purchase order parser.
 *
 * No AI model, no API call, no credit consumed, and nothing leaves the browser.
 * Recognition is driven entirely by the templates in poTemplates.ts.
 */

import { extractPdfLayoutText, fileHash } from './pdfText';
import { detectTemplate, type FieldSpec, type PoTemplate } from './poTemplates';

export const PARSER_VERSION = '1.0.0';

const TOL = 0.02; // rounding tolerance, in the order currency

export type ValidationLevel = 'error' | 'warn';

export interface Validation {
  level: ValidationLevel;
  code: string;
  message: string;
  field: string | null;
}

export interface PoHeader {
  poNumber: string | null; contractRef: string | null; revision: string | null;
  issueDate: string | null; issueHour: string | null; rfqNumber: string | null;
  responseNumber: string | null; supplierRef: string | null; billingName: string | null;
  customerTaxId: string | null; shipToName: string | null; buyerName: string | null;
  buyerEmail: string | null; supplierName: string | null; supplierContact: string | null;
  supplierEmail: string | null; noteToVendor: string | null;
}

export interface PoItem {
  lineNumber: number; itemCode: string; description: string | null;
  quantity: number | null; uom: string; unitPrice: number | null;
  deliverDate: string | null; amount: number | null;
  priority: boolean; priorityRaw: string; prWo: string; organization: string;
  additionalInfo: string | null; longDescription: string | null;
}

export interface PoTotals {
  paymentTerms: string | null; billCurrency: string | null; incoterm: string | null;
  agreementNo: string | null; contractNo: string | null;
  totalItems: number | null; totalGross: number | null; currency: string;
}

export interface PoApproval {
  approvedBy: string | null;
  approvedDate: string | null;
}

export interface PoSource {
  fileName: string | null; fileHash: string; pageCount: number;
  templateId: string; parsedAt: string; parserVersion: string;
}

export interface PoData {
  header: PoHeader;
  items: PoItem[];
  totals: PoTotals;
  approval: PoApproval;
  source: PoSource;
}

/** Stable contract between parser, review dialog and the import service. */
export interface ParseResult {
  ok: boolean;
  error: { code: string; message: string } | null;
  template: { id: string; label: string; customer: string } | null;
  confidence: number;
  data: PoData | null;
  validations: Validation[];
  elapsedMs: number;
}

/* ------------------------------------------------------------------ */
/* Conversion helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parses US (1,865.00) OR BR (1.865,00) formatted numbers.
 *
 * The Foresea purchase order mixes both on the SAME line: Unit Price reads
 * 84,728.20 while Amount reads 84.728,20. Rule: whichever separator appears
 * last is the decimal separator.
 *
 * Do not replace this with parseFloat or Number — parseFloat('84.728,20') is
 * 84.728, a three-orders-of-magnitude error heading straight for invoicing.
 * Any change here must re-run the acceptance fixtures.
 */
export function parseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  const value = String(raw).trim().replace(/\s/g, '');
  if (!value || !/\d/.test(value)) return null;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');

  let normalized: string;
  if (lastDot > lastComma) normalized = value.replace(/,/g, '');
  else if (lastComma > lastDot) normalized = value.replace(/\./g, '').replace(',', '.');
  else normalized = value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** dd/MM/yyyy -> ISO yyyy-MM-dd, for a Dataverse Date Only column (no timezone). */
export function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  const match = String(raw).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

const collapse = (value: string | null | undefined): string | null =>
  value == null ? null : String(value).replace(/\s+/g, ' ').trim() || null;

function applyField(text: string, spec: FieldSpec): string | number | null {
  const match = text.match(spec.re);
  if (!match) return null;

  const cleaned = collapse(match[spec.group ?? 1]);
  if (cleaned === null) return null;

  if (spec.type === 'number') return parseAmount(cleaned);
  if (spec.type === 'date') return parseDate(cleaned);
  return cleaned;
}

const asText = (value: string | number | null): string | null =>
  value == null ? null : String(value);
const asNumber = (value: string | number | null): number | null =>
  typeof value === 'number' ? value : null;

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

function failure(code: string, message: string): ParseResult {
  return {
    ok: false, error: { code, message }, template: null, confidence: 0,
    data: null, validations: [{ level: 'error', code, message, field: null }], elapsedMs: 0,
  };
}

export async function parsePurchaseOrder(
  data: ArrayBuffer,
  meta: { fileName?: string } = {},
): Promise<ParseResult> {
  const started = performance.now();

  const extraction = await extractPdfLayoutText(data);

  if (!extraction.hasTextLayer) {
    return failure('SCANNED_PDF',
      'This PDF has no text layer (scanned document). Automatic recognition requires the original PDF issued by the customer portal.');
  }

  const detection = detectTemplate(extraction.text);
  if (!detection) {
    return failure('UNKNOWN_TEMPLATE',
      'Purchase order layout not recognized. No registered template matches this document.');
  }

  const template = detection.template;
  const bodyText = extraction.text.split(template.bodyEndsAt)[0];

  const { header, missingRequired } = readHeader(bodyText, template);
  const items = readItems(bodyText.split('\n'), template);
  const totals = readTotals(bodyText, template);
  const approval: PoApproval = {
    approvedBy: asText(applyField(bodyText, template.approval.approvedBy)),
    approvedDate: asText(applyField(bodyText, template.approval.approvedDate)),
  };

  const validations = validate(header, items, totals, missingRequired);
  const errors = validations.filter((entry) => entry.level === 'error');

  return {
    ok: errors.length === 0 && items.length > 0,
    error: null,
    template: { id: template.id, label: template.label, customer: template.customer },
    confidence: computeConfidence(detection.score, header, items, validations),
    data: {
      header, items, totals, approval,
      source: {
        fileName: meta.fileName ?? null,
        fileHash: await fileHash(data),
        pageCount: extraction.pageCount,
        templateId: template.id,
        parsedAt: new Date().toISOString(),
        parserVersion: PARSER_VERSION,
      },
    },
    validations,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function readHeader(bodyText: string, template: PoTemplate) {
  const fields: Record<string, string | null> = {};
  const missingRequired: string[] = [];

  for (const [key, spec] of Object.entries(template.header)) {
    const value = asText(applyField(bodyText, spec));
    fields[key] = value;
    if (spec.required && !value) missingRequired.push(key);
  }

  return { header: fields as unknown as PoHeader, missingRequired };
}

function readItems(bodyLines: string[], template: PoTemplate): PoItem[] {
  const items: PoItem[] = [];
  let current: PoItem | null = null;

  const isNoise = (line: string) => template.noiseLines.some((re) => re.test(line));

  for (const line of bodyLines) {
    const rowMatch = line.match(template.itemRow);

    if (rowMatch) {
      if (current) items.push(current);
      const [, lineNo, itemCode, description, qty, uom, unitPrice, deliverDate, amount, priority, prWo, organization] = rowMatch;
      current = {
        lineNumber: Number(lineNo),
        itemCode: itemCode.trim(),
        description: collapse(description),
        quantity: parseAmount(qty),
        uom: uom.trim(),
        unitPrice: parseAmount(unitPrice),
        deliverDate: parseDate(deliverDate),
        amount: parseAmount(amount),
        priority: /^[ys]/i.test(priority),
        priorityRaw: priority.trim(),
        prWo: prWo.trim(),
        organization: organization.trim(),
        additionalInfo: null,
        longDescription: null,
      };
      continue;
    }

    if (!current) continue;

    const additionalInfo = line.match(template.itemMeta.additionalInfo);
    if (additionalInfo) { current.additionalInfo = collapse(additionalInfo[1]); continue; }

    const longDescription = line.match(template.itemMeta.longDescription);
    if (longDescription) { current.longDescription = collapse(longDescription[1]); continue; }

    if (/^\s*Comercial\s+Terms:/i.test(line)) { items.push(current); current = null; continue; }

    // Description continuation: indented line with no numeric columns.
    if (!isNoise(line) && !current.longDescription && line.trim().length > 2) {
      current.description = collapse(`${current.description} ${line}`);
    }
  }

  if (current) items.push(current);
  return items;
}

function readTotals(bodyText: string, template: PoTemplate): PoTotals {
  const billCurrency = asText(applyField(bodyText, template.totals.billCurrency));
  const grossMatch = bodyText.match(template.totals.totalGross.re);

  return {
    paymentTerms: asText(applyField(bodyText, template.totals.paymentTerms)),
    billCurrency,
    incoterm: asText(applyField(bodyText, template.totals.incoterm)),
    agreementNo: asText(applyField(bodyText, template.totals.agreementNo)),
    contractNo: asText(applyField(bodyText, template.totals.contractNo)),
    totalItems: asNumber(applyField(bodyText, template.totals.totalItems)),
    totalGross: asNumber(applyField(bodyText, template.totals.totalGross)),
    currency: grossMatch?.[1] || billCurrency || template.currencyDefault,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validate(header: PoHeader, items: PoItem[], totals: PoTotals, missingRequired: string[]): Validation[] {
  const out: Validation[] = [];
  const add = (level: ValidationLevel, code: string, message: string, field: string | null) =>
    out.push({ level, code, message, field });

  for (const field of missingRequired) {
    add('error', 'MISSING_FIELD', `Required field not found in the PDF: ${field}.`, field);
  }

  if (!items.length) {
    add('error', 'NO_ITEMS', 'No line items were recognized in the purchase order table.', 'items');
    return out;
  }

  for (const item of items) {
    if (item.quantity != null && item.unitPrice != null && item.amount != null) {
      const expected = item.quantity * item.unitPrice;
      if (Math.abs(expected - item.amount) > TOL) {
        add('error', 'LINE_MATH',
          `Line ${item.lineNumber}: Qty × Unit Price = ${expected.toFixed(2)} but the stated Amount is ${item.amount.toFixed(2)}.`,
          `items[${item.lineNumber}].amount`);
      }
    }
    if (!item.deliverDate) {
      add('warn', 'NO_DELIVER_DATE', `Line ${item.lineNumber}: no valid delivery date.`, `items[${item.lineNumber}].deliverDate`);
    }
    if (item.itemCode && !/^\d{9,16}$/.test(item.itemCode)) {
      add('warn', 'ITEM_CODE_FORMAT', `Line ${item.lineNumber}: item code does not match the numeric pattern (${item.itemCode}).`, `items[${item.lineNumber}].itemCode`);
    }
  }

  const sum = items.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  if (totals.totalItems != null && Math.abs(sum - totals.totalItems) > TOL) {
    add('error', 'TOTAL_MISMATCH',
      `Sum of lines (${sum.toFixed(2)}) differs from Total Value of Items (${totals.totalItems.toFixed(2)}).`,
      'totals.totalItems');
  }
  if (totals.totalGross != null && totals.totalItems != null && Math.abs(totals.totalGross - totals.totalItems) > TOL) {
    add('warn', 'GROSS_DIFFERS',
      'Total Gross differs from Total of Items — check for freight, tax or discount on the order.',
      'totals.totalGross');
  }

  const seen = new Set<number>();
  for (const item of items) {
    if (seen.has(item.lineNumber)) {
      add('error', 'DUPLICATE_LINE', `Line number ${item.lineNumber} appears more than once.`, 'items');
    }
    seen.add(item.lineNumber);
  }

  for (const item of items) {
    if (header.issueDate && item.deliverDate && item.deliverDate < header.issueDate) {
      add('warn', 'DELIVERY_BEFORE_ISSUE',
        `Line ${item.lineNumber}: delivery date is earlier than the PO issue date.`,
        `items[${item.lineNumber}].deliverDate`);
    }
  }

  if (header.supplierName && !/WEATHERFORD/i.test(header.supplierName)) {
    add('warn', 'SUPPLIER_NOT_WFRD',
      `Supplier in the PDF is not Weatherford: "${header.supplierName}". Confirm before importing.`,
      'header.supplierName');
  }

  return out;
}

/**
 * Confidence measures COVERAGE, not correctness: a field that is filled with a
 * wrong value still counts as filled. Treat it as a recognition signal, never as
 * proof the data is right — that is what the review dialog is for.
 */
function computeConfidence(templateScore: number, header: PoHeader, items: PoItem[], validations: Validation[]): number {
  const headerValues = Object.values(header);
  const headerScore = headerValues.length
    ? headerValues.filter((value) => value != null).length / headerValues.length
    : 0;

  const mathOk = items.length
    ? items.filter((item) => item.quantity != null && item.unitPrice != null && item.amount != null
        && Math.abs(item.quantity * item.unitPrice - item.amount) <= TOL).length / items.length
    : 0;

  const errorPenalty = validations.filter((entry) => entry.level === 'error').length * 0.15;
  const score = 0.35 * templateScore + 0.25 * headerScore + 0.40 * mathOk - errorPenalty;

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}
