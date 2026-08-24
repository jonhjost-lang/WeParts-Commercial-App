import { useCallback, useRef, useState } from 'react';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface AIUploadPOBannerProps {
  onFile: (file: File) => void;
  supportedLabel?: string;
  disabled?: boolean;
}

/**
 * Home band that accepts a purchase order PDF, by drop or by file picker.
 * Parsing happens in POUploadDialog — this only validates and hands the file over.
 */
export default function AIUploadPOBanner({
  onFile,
  supportedLabel = 'Foresea · Layout v6',
  disabled = false,
}: AIUploadPOBannerProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    setError(null);
    const file = fileList?.[0];
    if (!file) return;

    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Invalid format. Upload the original purchase order PDF.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File exceeds 25 MB.');
      return;
    }
    onFile(file);
  }, [onFile]);

  return (
    <section
      className={`wep-poband${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) handleFiles(event.dataTransfer.files); }}
      aria-label="Purchase order upload with automatic recognition"
    >
      <div className="wep-poband-left">
        <div className="wep-poband-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <path d="M14 2v5h5" />
            <path d="M9 13h6M9 17h4" />
          </svg>
        </div>
        <div>
          <p className="wep-poband-eyebrow">AI Upload PO</p>
          <h3 className="wep-poband-title">Upload the PO PDF. Line items are recognized automatically.</h3>
        </div>
      </div>

      <div className="wep-poband-right">
        <div className="wep-poband-copy">
          <p className="wep-poband-text">
            Drop the purchase order here or pick a file. Each line is read, quantity × unit price ×
            total is checked, and the order is assembled for your review.
          </p>
          <div className="wep-poband-chips">
            <span className="wep-poband-chip"><i className="wep-poband-dot" />{supportedLabel}</span>
            <span className="wep-poband-chip is-muted">Processed in your browser</span>
          </div>
          {error ? <p className="wep-poband-error" role="alert">{error}</p> : null}
        </div>

        <div className="wep-poband-actions">
          <button type="button" className="wep-poband-btn" disabled={disabled} onClick={() => inputRef.current?.click()}>
            Select PDF
          </button>
          <span className="wep-poband-hint">or drop the file</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => { handleFiles(event.target.files); event.target.value = ''; }}
        />
      </div>

      {dragging ? <div className="wep-poband-overlay"><span>Drop the purchase order PDF</span></div> : null}
    </section>
  );
}
