import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { getMpdPriceList, type PriceListItem } from '../../services/priceList';
import { downloadThreeDObject, getThreeDObjects } from '../../services/threeDObjects';
import { getUserPhoto } from '../../services/currentUser';
import LoadingMark from '../ui/LoadingMark';

const ObjectViewer = lazy(() => import('../three/ObjectViewer'));
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const PAGE_SIZE = 20;
const CONTRACT_URL = 'https://weatherford.sharepoint.com/sites/tmsbrm1730-Sales/Shared%20Documents/Sales/Contract%20WFRD/BRA-25-TP-91186C-FORESEA-MPD%20-%20Rev3.pdf';
const SUPPORT_EMAIL = 'pedro.rigotti@Weatherford.com';
const OUTLOOK_URL = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(SUPPORT_EMAIL)}&subject=${encodeURIComponent('WeParts MPD Catalog Support')}`;
const TEAMS_URL = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(SUPPORT_EMAIL)}`;
type CatalogSort = 'default' | 'lead-asc' | 'lead-desc' | 'price-asc' | 'price-desc';

export default function PurchaseCatalogScreen() {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All products');
  const [sort, setSort] = useState<CatalogSort>('default');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelData, setModelData] = useState<Uint8Array | null>(null);
  const [modelName, setModelName] = useState('');
  const [review, setReview] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportPhoto, setSupportPhoto] = useState<string | null>(null);
  const [po, setPo] = useState<File | null>(null);
  const [toast, setToast] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [catalog, objects] = await Promise.all([getMpdPriceList(), getThreeDObjects('Managed Pressure Drilling')]);
        if (!live) return;
        setItems(catalog);
        setLoading(false);
        if (objects[0]) {
          const model = await downloadThreeDObject(objects[0]);
          if (live) { setModelData(model.data); setModelName(model.fileName); }
        }
      } catch (reason) { if (live) setError(reason instanceof Error ? reason.message : 'Unable to load the MPD experience.'); }
      finally { if (live) { setLoading(false); setModelLoading(false); } }
    };
    void load(); return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    void getUserPhoto(SUPPORT_EMAIL).then((photo) => { if (live) setSupportPhoto(photo); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!review && !supportOpen) return;
    document.body.classList.add('weparts-dialog-open');
    return () => document.body.classList.remove('weparts-dialog-open');
  }, [review, supportOpen]);

  const categories = useMemo(() => ['All products', ...Array.from(new Set(items.map((x) => x.classification).filter(Boolean))).slice(0, 5)], [items]);
  const visible = useMemo(() => {
    const filtered = items.filter((item) => (category === 'All products' || item.classification === category) &&
      [item.description, item.partNumber, item.itemNumber].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === 'default') return filtered;
    return [...filtered].sort((a, b) => {
      if (sort === 'price-asc') return a.unitPrice - b.unitPrice;
      if (sort === 'price-desc') return b.unitPrice - a.unitPrice;
      if (a.leadTimeDays === null) return 1;
      if (b.leadTimeDays === null) return -1;
      return sort === 'lead-asc' ? a.leadTimeDays - b.leadTimeDays : b.leadTimeDays - a.leadTimeDays;
    });
  }, [items, search, category, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = items.filter((item) => cart[item.id]);
  const units = selected.reduce((sum, item) => sum + cart[item.id], 0);
  const total = selected.reduce((sum, item) => sum + item.unitPrice * cart[item.id], 0);
  const quantity = (id: string, value: number) => setCart((current) => { const next = { ...current }; if (value > 0) next[id] = Math.min(9999, Math.floor(value)); else delete next[id]; return next; });

  return (
    <section className="screen active mpd-lab">
      <div className="lab-hero">
        <div className="lab-copy"><span className="lab-tag">PRODUCT LINE · MANAGED PRESSURE DRILLING</span><h1>Pressure, precisely managed.</h1><p>Configure the MPD parts your operation needs through a visual, product-led buying experience.</p><div className="lab-facts"><span><b>{items.length || '—'}</b> available parts</span><span><b>USD</b> contract pricing</span><span><b>3D</b> equipment preview</span></div></div>
        <div className="lab-viewer"><div className="lab-viewer-label"><span>LIVE EQUIPMENT VIEW</span><b>Managed Pressure Drilling</b></div>{modelLoading ? <div className="model-state"><LoadingMark /><span>Preparing equipment...</span></div> : null}{!modelLoading && modelData ? <Suspense fallback={<div className="model-state"><LoadingMark /></div>}><ObjectViewer data={modelData} fileName={modelName} /></Suspense> : null}{!modelLoading && !modelData ? <div className="model-state"><b>3D model unavailable</b><span>{error || 'No MPD attachment was found.'}</span></div> : null}<div className="lab-viewer-help">Drag to rotate · Scroll to zoom</div></div>
      </div>

      <div className="catalog-utility-bar" aria-label="Catalog resources">
        <a className="catalog-utility-item" href={CONTRACT_URL} target="_blank" rel="noreferrer">
          <span className="catalog-utility-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12h5M10 16h5"/></svg></span>
          <span><small>COMMERCIAL DOCUMENT</small><b>View price contract</b><em>Opens securely in SharePoint</em></span><strong aria-hidden="true">↗</strong>
        </a>
        <button className="catalog-utility-item" onClick={() => setSupportOpen(true)}>
          <span className="catalog-utility-icon support"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z"/><path d="M8 9h8M8 13h5"/></svg></span>
          <span><small>NEED ASSISTANCE?</small><b>Contact catalog support</b><em>Sales Engineer · MPD</em></span><strong aria-hidden="true">→</strong>
        </button>
      </div>

      <div className="lab-shop-head"><div><span className="section-number">BUILD YOUR REQUEST</span><h2>MPD parts catalog</h2></div><div className="catalog-head-tools"><div className="lab-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><div><label htmlFor="mpd-lab-search">Search catalog</label><input id="mpd-lab-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Part number, item or description" /></div>{search ? <button onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search">×</button> : <kbd>/</kbd>}</div><label className="catalog-sort" htmlFor="mpd-catalog-sort"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h8M8 18h4M4 5v14m0 0-2-2m2 2 2-2"/></svg><span><small>SORT BY</small><select id="mpd-catalog-sort" value={sort} onChange={(e) => { setSort(e.target.value as CatalogSort); setPage(1); }}><option value="default">Default order</option><option value="lead-asc">Lead time · Low to high</option><option value="lead-desc">Lead time · High to low</option><option value="price-asc">Unit price · Low to high</option><option value="price-desc">Unit price · High to low</option></select></span></label></div></div>
      <div className="lab-categories">{categories.map((value) => <button className={category === value ? 'active' : ''} onClick={() => { setCategory(value); setPage(1); }} key={value}>{value}</button>)}</div>
      {loading ? <div className="commerce-loading"><LoadingMark /><span>Loading catalog...</span></div> : null}
      {!loading && error && !items.length ? <div className="commerce-error">{error}</div> : null}
      {!loading && visible.length ? <div className="catalog-table-shell"><div className="catalog-table-scroll"><table className="catalog-table"><thead><tr><th>Product</th><th>Classification</th><th>Lead time</th><th className="numeric">Unit price</th><th className="quantity-column">Quantity</th></tr></thead><tbody>{pageItems.map((item) => <tr className={cart[item.id] ? 'selected' : ''} key={item.id}><td><div className="table-product"><div><b>{item.description}</b><span>PN {item.partNumber}{item.itemNumber !== null ? ` · Item ${item.itemNumber}` : ''}</span></div></div></td><td><span className="classification-badge">{item.classification}</span></td><td><span className="lead-time-value"><b>{item.leadTimeDays ?? '—'}</b> days</span></td><td className="numeric"><strong className="table-price">{usd.format(item.unitPrice)}</strong></td><td><div className="table-qty"><button onClick={() => quantity(item.id, Math.max(0, (cart[item.id] || 0) - 1))} disabled={!cart[item.id]} aria-label="Decrease quantity">−</button><input aria-label={`Quantity for ${item.description}`} type="number" min="0" value={cart[item.id] || ''} placeholder="0" onChange={(e) => quantity(item.id, Number(e.target.value))} /><button onClick={() => quantity(item.id, (cart[item.id] || 0) + 1)} aria-label="Increase quantity">＋</button></div></td></tr>)}</tbody></table></div><div className="catalog-pagination"><span>Showing <b>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)}</b> of <b>{visible.length}</b> products</span><div><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} aria-label="Previous page">←</button><span>Page <b>{page}</b> of {pageCount}</span><button onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount} aria-label="Next page">→</button></div></div></div> : null}
      {!loading && !visible.length && !error ? <div className="table-empty-state"><span>⌕</span><b>No products found</b><p>Try adjusting your search or classification filter.</p><button onClick={() => { setSearch(''); setCategory('All products'); }}>Clear filters</button></div> : null}

      <div className={`lab-cart-dock${selected.length ? ' visible' : ''}`}><div><span>{selected.length} products · {units} units</span><strong>{usd.format(total)}</strong></div><div className="dock-thumbs">{selected.slice(0, 3).map((item) => <b key={item.id}>{item.partNumber.slice(0, 2)}</b>)}{selected.length > 3 ? <b>+{selected.length - 3}</b> : null}</div><button onClick={() => setReview(true)}>Review request <span>→</span></button></div>

      {review ? <div className="review-backdrop modern-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setReview(false); }}><div className="review-panel lab-review modern-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="review-head"><div><span className="commerce-kicker">PURCHASE REQUEST</span><h2 id="review-title">Review selected products</h2><p>Confirm quantities and optionally attach your purchase order.</p></div><button onClick={() => setReview(false)} aria-label="Close dialog">×</button></div><div className="review-body"><div className="review-items">{selected.map((item) => <div className="review-item" key={item.id}><span className="review-item-mark">{item.partNumber.slice(0, 2)}</span><div><b>{item.description}</b><span>PN {item.partNumber} · {usd.format(item.unitPrice)} each</span></div><div className="review-qty"><span>QTY</span><div><button onClick={() => quantity(item.id, Math.max(1, cart[item.id] - 1))} disabled={cart[item.id] <= 1} aria-label="Decrease quantity">−</button><input value={cart[item.id]} type="number" min="1" onChange={(e) => quantity(item.id, Number(e.target.value))} /><button onClick={() => quantity(item.id, cart[item.id] + 1)} aria-label="Increase quantity">＋</button></div></div><strong>{usd.format(item.unitPrice * cart[item.id])}</strong><button onClick={() => quantity(item.id, 0)} aria-label={`Remove ${item.description}`}>×</button></div>)}</div><div className={`po-upload modern-upload${po ? ' has-file' : ''}`}><span className="commerce-kicker">OPTIONAL PURCHASE ORDER</span><input ref={fileInput} hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const next = e.target.files?.[0] || null; setPo(next); if (next) { setToast(`${next.name} attached`); window.setTimeout(() => setToast(''), 2600); } }} /><button onClick={() => fileInput.current?.click()}><span>{po ? '✓' : '↑'}</span><b>{po?.name || 'Drop a PO here or browse'}</b><small>{po ? `${(po.size / 1024 / 1024).toFixed(2)} MB · Ready to submit` : 'PDF, Word, Excel or image · max. 10 MB'}</small></button>{po ? <button className="remove-file" onClick={() => setPo(null)}>Remove file</button> : null}</div></div><div className="review-footer"><div><span>Estimated total · {units} units</span><strong>{usd.format(total)}</strong></div><button className="btn btn-secondary" onClick={() => setReview(false)}>Continue shopping</button><button className="btn btn-primary" disabled>Submit after order table setup</button></div></div></div> : null}
      {supportOpen ? <div className="review-backdrop modern-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSupportOpen(false); }}><div className="support-dialog" role="dialog" aria-modal="true" aria-labelledby="support-title" aria-describedby="support-description"><div className="support-dialog-top"><span className="commerce-kicker">CATALOG SUPPORT</span><button onClick={() => setSupportOpen(false)} aria-label="Close support dialog">×</button></div><div className="support-intro"><span className={`support-avatar${supportPhoto ? ' has-photo' : ''}`}>{supportPhoto ? <img src={supportPhoto} alt="Pedro Rigotti" /> : 'PR'}</span><div><h2 id="support-title">Pedro Rigotti</h2><p id="support-description">Sales Engineer</p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></div></div><div className="support-note"><span>●</span><p><b>MPD commercial assistance</b>Get help with catalog items, contract pricing or your purchase request.</p></div><div className="support-actions"><a href={OUTLOOK_URL} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3z"/><path d="m3 6 9 7 9-7"/></svg><span><b>Send an email</b><small>Open in Outlook</small></span><strong>↗</strong></a><a href={TEAMS_URL} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8v10H8zM4 9h4v6H4M16 9h4v6h-4"/><circle cx="12" cy="4" r="2"/></svg><span><b>Start a conversation</b><small>Open in Microsoft Teams</small></span><strong>↗</strong></a></div></div></div> : null}
      {toast ? <div className="modern-toast" role="status"><span>✓</span><div><b>Attachment added</b><small>{toast}</small></div></div> : null}
    </section>
  );
}
