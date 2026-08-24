import { useEffect, useState } from 'react';

import { parsePurchaseOrder, type ParseResult, type PoData } from '../../lib/poParser';

interface POUploadDialogProps {
  file: File;
  onClose: () => void;
  onConfirm: (data: PoData) => void | Promise<void>;
}

/**
 * Review step. The parser never writes on its own: it proposes, a person
 * confirms. Validations of level 'error' block the import; warnings only warn.
 */
export default function POUploadDialog({ file, onClose, onConfirm }: POUploadDialogProps) {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await parsePurchaseOrder(buffer, { fileName: file.name });
        if (!cancelled) setResult(parsed);
      } catch (error) {
        if (cancelled) return;
        setResult({
          ok: false,
          error: { code: 'PARSE_CRASH', message: error instanceof Error ? error.message : 'Failed to read the PDF.' },
          template: null, confidence: 0, data: null, validations: [], elapsedMs: 0,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    document.body.classList.add('weparts-dialog-open');
    return () => document.body.classList.remove('weparts-dialog-open');
  }, []);

  const errors = result?.validations.filter((entry) => entry.level === 'error') ?? [];
  const warnings = result?.validations.filter((entry) => entry.level === 'warn') ?? [];

  const confirm = async () => {
    if (!result?.data) return;
    setSaving(true);
    try { await onConfirm(result.data); } finally { setSaving(false); }
  };

  return (
    <div className="wep-pomodal" role="dialog" aria-modal="true" aria-label="Purchase order review">
      <div className="wep-pomodal-panel">
        <header className="wep-pomodal-head">
          <div>
            <p className="wep-pomodal-eyebrow">AI Upload PO</p>
            <h2 className="wep-pomodal-title">{result?.data?.header.poNumber || 'Recognizing document...'}</h2>
            <p className="wep-pomodal-file">{file.name}</p>
          </div>
          <button type="button" className="wep-pomodal-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="wep-pomodal-body">
          {!result ? (
            <div className="wep-po-empty">
              <div className="wep-po-spinner" aria-hidden="true" />
              <p>Reading the purchase order and checking values...</p>
            </div>
          ) : null}

          {result?.error ? (
            <div className="wep-po-alert is-error">
              <strong>{titleFor(result.error.code)}</strong>
              <p>{result.error.message}</p>
            </div>
          ) : null}

          {result?.data ? (
            <>
              <div className="wep-po-meta">
                <Badge tone={result.confidence >= 0.9 ? 'ok' : result.confidence >= 0.7 ? 'warn' : 'bad'}
                  label={`Confidence ${(result.confidence * 100).toFixed(0)}%`} />
                <Badge label={result.template?.label ?? ''} />
                <Badge label={`${result.data.items.length} line(s)`} />
                <Badge label={`${result.elapsedMs} ms`} />
              </div>

              {errors.length ? (
                <div className="wep-po-alert is-error">
                  <strong>Import blocked — {errors.length} inconsistency(ies)</strong>
                  <ul>{errors.map((entry, index) => <li key={index}>{entry.message}</li>)}</ul>
                </div>
              ) : null}
              {warnings.length ? (
                <div className="wep-po-alert is-warn">
                  <strong>{warnings.length} point(s) to review</strong>
                  <ul>{warnings.map((entry, index) => <li key={index}>{entry.message}</li>)}</ul>
                </div>
              ) : null}

              <h3 className="wep-po-h3">Header</h3>
              <dl className="wep-po-grid">
                <Field label="PO" value={result.data.header.poNumber} />
                <Field label="Revision" value={result.data.header.revision} />
                <Field label="Issue date" value={formatDate(result.data.header.issueDate)} />
                <Field label="Contract / Unit" value={result.data.header.contractRef} />
                <Field label="RFQ" value={result.data.header.rfqNumber} />
                <Field label="Response" value={result.data.header.responseNumber} />
                <Field label="Supplier ref." value={result.data.header.supplierRef} />
                <Field label="Billing" value={result.data.header.billingName} />
                <Field label="Ship to" value={result.data.header.shipToName} />
                <Field label="Buyer" value={result.data.header.buyerName} />
                <Field label="Buyer email" value={result.data.header.buyerEmail} />
                <Field label="Supplier" value={result.data.header.supplierName} />
                <Field label="Incoterm" value={result.data.totals.incoterm} />
                <Field label="Payment terms" value={result.data.totals.paymentTerms} />
              </dl>

              <h3 className="wep-po-h3">Line items</h3>
              <div className="wep-po-tablewrap">
                <table className="wep-po-table">
                  <thead>
                    <tr>
                      <th>Line</th><th>Item Code</th><th>Description</th>
                      <th className="num">Qty</th><th>UOM</th>
                      <th className="num">Unit Price</th><th>Delivery</th>
                      <th className="num">Amount</th><th>PR/WO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.items.map((item) => (
                      <tr key={item.lineNumber}>
                        <td>{item.lineNumber}</td>
                        <td className="mono">{item.itemCode}</td>
                        <td className="desc" title={item.longDescription || item.description || ''}>{item.description}</td>
                        <td className="num">{item.quantity}</td>
                        <td>{item.uom}</td>
                        <td className="num">{formatMoney(item.unitPrice)}</td>
                        <td>{formatDate(item.deliverDate)}</td>
                        <td className="num">{formatMoney(item.amount)}</td>
                        <td>{item.prWo}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7}>Order total ({result.data.totals.currency})</td>
                      <td className="num strong">{formatMoney(result.data.totals.totalGross)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <footer className="wep-pomodal-foot">
          <button type="button" className="wep-po-btn is-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="wep-po-btn is-primary" disabled={!result?.ok || saving} onClick={confirm}>
            {saving ? 'Importing...' : 'Confirm and create order'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="wep-po-field">
      <dt>{label}</dt>
      <dd className={value ? '' : 'is-empty'}>{value || '—'}</dd>
    </div>
  );
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  return <span className={`wep-po-badge is-${tone}`}>{label}</span>;
}

const formatMoney = (value: number | null) =>
  value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const titleFor = (code: string) => ({
  SCANNED_PDF: 'PDF has no text layer',
  UNKNOWN_TEMPLATE: 'Unrecognized layout',
  PARSE_CRASH: 'Could not process the file',
}[code] || 'Could not recognize this document');
