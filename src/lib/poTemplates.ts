/**
 * Registry of recognized purchase order layouts.
 *
 * To support a new customer, add an entry to PO_TEMPLATES. No React component
 * changes: the parser picks the template with the best fingerprint match.
 */

export interface FieldSpec {
  re: RegExp;
  required?: boolean;
  type?: 'number' | 'date';
  clean?: 'collapse';
  group?: number;
}

export interface PoTemplate {
  id: string;
  label: string;
  customer: string;
  currencyDefault: string;
  fingerprint: { all: RegExp[]; any: RegExp[] };
  bodyEndsAt: RegExp;
  header: Record<string, FieldSpec>;
  itemRow: RegExp;
  itemMeta: { additionalInfo: RegExp; longDescription: RegExp };
  noiseLines: RegExp[];
  totals: Record<string, FieldSpec>;
  approval: Record<string, FieldSpec>;
}

/**
 * Horizontal whitespace only — never crosses a line break.
 *
 * `\s*` after a label is a trap: when the field is empty, it walks past the
 * newline and the capture group swallows the next line. That is how
 * `Nº Agreement:` used to yield "Nº Contract:" and `Nº Contract:` used to yield
 * the approval line. Verified against PO122278, PO122245 and PO122153.
 */
const H = '[^\\S\\r\\n]*';

export const PO_TEMPLATES: PoTemplate[] = [
  {
    id: 'FORESEA_PO_V6',
    label: 'Foresea S.A. — Purchase Order (Layout v6)',
    customer: 'FORESEA S.A.',
    currencyDefault: 'USD',

    fingerprint: {
      all: [/Purchase\s+Order:\s*PO\d+/i, /FORESEA/i],
      any: [/Layout\s*v6/i, /Comercial\s+Terms:/i, /Total\s+Gross\s+Value\s+of\s+Order/i],
    },

    // The order body ends where the legal annexes begin.
    bodyEndsAt: /SHIPPING\s+INSTRUCTIONS|GENERAL\s+TERMS\s+AND\s+CONDITIONS/i,

    header: {
      poNumber: { re: /Purchase\s+Order:\s*(PO[\w-]+)/i, required: true },
      contractRef: { re: /Purchase\s+Order:\s*PO[\w-]+\s*-\s*(.+?)(?:\s{2,}|\s+(?:Page|Rev|Date|Hour|N[º°o]\s*(?:RFQ|Response)|Ref\.Supplier)\s*:|$)/i },
      revision: { re: /\bRev:\s*(\d+)/i },
      issueDate: { re: /\bDate:\s*(\d{2}\/\d{2}\/\d{4})/i, required: true, type: 'date' },
      issueHour: { re: /\bHour:\s*(\d{1,2}:\d{2})/i },
      rfqNumber: { re: /N[º°o]\s*RFQ:\s*([\w\-/.]+)/i },
      responseNumber: { re: /N[º°o]\s*Response:\s*([\w\-/.]+)/i },
      supplierRef: { re: /Ref\.Supplier:\s*([\s\S]{0,60}?)(?=\s{2,}|Customer's|$)/i, clean: 'collapse' },

      /**
       * "Billing:" and "Ship To:" are labels sharing one visual line; the values
       * sit on the line below, in two columns. Take the next line and capture
       * the left column, stopping at the gap that separates it from Ship To.
       */
      billingName: { re: new RegExp(`Billing:[^\\n]*\\n${H}([A-Z0-9][^\\n]*?)(?:\\s{2,}|$)`, 'im') },
      customerTaxId: { re: /CNPJ:\s*([\d.\-/]{8,20})/i },
      shipToName: { re: /Ship\s+To:[\s\S]{0,80}?\n\s*[^\n]*?\s{2,}([A-Z][A-Z0-9 .,&-]{3,60}?)\s*$/im },

      buyerName: { re: /Buyer:\s*(.+?)\s+Email:/i, required: true },
      buyerEmail: { re: /Buyer:.+?Email:\s*(\S+@\S+)/i, required: true },

      supplierName: { re: /Supplier's\s+Information:\s*\n\s*(.+?)\s*$/im, required: true },
      supplierContact: { re: /Contact:\s*(.+?)\s+Email:/i },
      supplierEmail: { re: /Contact:.+?Email:\s*(\S+@\S+)/i },

      noteToVendor: { re: /Note\s+to\s+Vendor:\s*([\s\S]{0,400}?)(?=\n\s*\n|\s{2,}Line\s|$)/i, clean: 'collapse' },
    },

    /**
     * Numeric columns share the visual line where the description starts;
     * description continuation lines follow underneath.
     * groups: 1=line 2=itemCode 3=description 4=qty 5=uom
     *         6=unitPrice 7=deliverDate 8=amount 9=priority 10=prWo 11=organization
     */
    itemRow: /^\s*(\d{1,4})\s+(\d{9,16})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,4})\s+([\d.,]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/,

    itemMeta: {
      additionalInfo: /^\s*Item\s+Additional\s+Information:\s*(.*)$/i,
      longDescription: /^\s*Long\s+Description:\s*(.*)$/i,
    },

    /** Lines that are never a description continuation. */
    noiseLines: [
      /^\s*Line\s+Item\s+Code\s+Description/i,
      /^\s*\(USD\)\s*$/i,
      /^\s*Comercial\s+Terms:/i,
      /^\s*Document\s+Electronically\s+Approved/i,
      /^\s*Layout\s+v\d+/i,
      /^\s*Page:\s*\d+/i,
      /^\s*\d+\s*\/\s*\d+\s*$/,
      /^\s*$/,
    ],

    totals: {
      paymentTerms: { re: new RegExp(`Payment\\s+Terms:${H}(.+?)(?:\\s{2,}|$)`, 'im') },
      billCurrency: { re: /Bill\s+Currency:\s*([A-Z]{3})/i },
      incoterm: { re: new RegExp(`INCOTERM:${H}(.+?)(?:\\s{2,}|$)`, 'im') },
      agreementNo: { re: new RegExp(`N[\\u00ba\\u00b0o]\\s*Agreement:${H}([^\\n]*?)${H}$`, 'im') },
      contractNo: { re: new RegExp(`N[\\u00ba\\u00b0o]\\s*Contract:${H}([^\\n]*?)${H}$`, 'im') },
      totalItems: { re: /Total\s+Value\s+of\s+Items:\s*([\d.,]+)/i, type: 'number' },
      totalGross: { re: /Total\s+Gross\s+Value\s+of\s+Order\s*\(([A-Z]{3})\):\s*([\d.,]+)/i, type: 'number', group: 2 },
    },

    approval: {
      approvedBy: { re: /Document\s+Electronically\s+Approved\s+by:\s*(.+?)\s+[–—-]\s+Date/i },
      approvedDate: { re: /Document\s+Electronically\s+Approved\s+by:.+?Date\s+(\d{2}\/\d{2}\/\d{4})/i, type: 'date' },
    },
  },
];

export interface TemplateMatch {
  template: PoTemplate;
  score: number;
}

/** Returns the template that best matches the text, or null. */
export function detectTemplate(text: string): TemplateMatch | null {
  let best: TemplateMatch | null = null;

  for (const template of PO_TEMPLATES) {
    if (!template.fingerprint.all.every((re) => re.test(text))) continue;

    const anyList = template.fingerprint.any;
    const anyHits = anyList.filter((re) => re.test(text)).length;
    const score = 0.7 + (anyList.length ? 0.3 * (anyHits / anyList.length) : 0.3);

    if (!best || score > best.score) best = { template, score };
  }

  return best;
}
