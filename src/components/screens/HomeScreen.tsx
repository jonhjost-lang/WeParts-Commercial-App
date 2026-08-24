import { lazy, Suspense, useState } from 'react';

import AIUploadPOBanner from '../po/AIUploadPOBanner';

// Pulls in the parser and pdfjs-dist (~450 kB). Loaded only when a file is
// actually dropped, so it never weighs on first paint.
const POUploadDialog = lazy(() => import('../po/POUploadDialog'));
import { isInternal, type UserProfile } from '../../config/accessControl';
import { canAccess } from '../../config/navigation';
import type { PoData } from '../../lib/poParser';
import { importPurchaseOrder } from '../../services/poImport';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
  profile: UserProfile;
}

export default function HomeScreen({ onNavigate, profile }: HomeScreenProps) {
  const [poFile, setPoFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const confirmImport = async (data: PoData) => {
    const outcome = await importPurchaseOrder(data);
    setPoFile(null);
    setNotice(outcome.message);
  };

  return (
    <section className="screen active global-home">
      <div className="global-hero">
        <div className="global-hero-copy">
          <span className="commerce-kicker">WEPARTS · MANAGED PRESSURE DRILLING</span>
          <h1>MPD parts.<br /><em>One commercial workspace.</em></h1>
          <p>Browse contracted products, create purchase requests and follow every order through fulfillment.</p>
          <div className="global-hero-actions">
            <button className="btn btn-primary" onClick={() => onNavigate('catalog')}>Browse catalog →</button>
            <span>CONTRACT-GOVERNED PRICING</span>
          </div>
        </div>
        <div className="global-map" aria-hidden="true">
          <span className="map-label">MANAGED PRESSURE DRILLING</span>
          <i className="map-orbit orbit-a"/><i className="map-orbit orbit-b"/><i className="map-orbit orbit-c"/>
          <i className="map-node node-a"/><i className="map-node node-b"/><i className="map-node node-c"/><i className="map-node node-d"/>
          <strong>MPD</strong><small>Commercial ordering portal</small>
        </div>
      </div>

      {/* Purchase orders are received from the customer and processed internally. */}
      {isInternal(profile) ? (
        <>
          <AIUploadPOBanner onFile={setPoFile} />
          {notice ? <p className="wep-po-notice" role="status">{notice}</p> : null}
        </>
      ) : null}

      <div className="global-stats">
        <button className="home-capability" onClick={() => onNavigate('catalog')}>
          <span className="home-capability-icon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span>
          <span className="home-capability-copy"><small>MPD</small><b>Purchase catalog</b><em>Browse parts and create a request</em></span>
          <span className="home-capability-tag">OPEN →</span>
        </button>
        <button className="home-capability" onClick={() => onNavigate('orders')}>
          <span className="home-capability-icon dark"><svg viewBox="0 0 24 24"><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/><path d="m15 16 1.5 1.5L20 14"/></svg></span>
          <span className="home-capability-copy"><small>ORDERS</small><b>Track requests</b><em>Review status, items and history</em></span>
          <span className="home-capability-tag live"><i/> LIVE</span>
        </button>
      </div>

      <div className="product-lines-section">
        <div className="global-section-head">
          <div>
            <span className="commerce-kicker">COMMERCIAL WORKSPACE</span>
            <h2>Everything needed to manage an MPD order.</h2>
            <p>One controlled journey from product selection to pickup and delivery, connected to your commercial data.</p>
          </div>
        </div>
        <div className="home-workflow">
          <button onClick={() => onNavigate('catalog')}><i>01</i><span><b>Select products</b><small>Choose parts and quantities</small></span><strong>→</strong></button>
          <button onClick={() => onNavigate('orders')}><i>02</i><span><b>Follow requests</b><small>See files, status and history</small></span><strong>→</strong></button>
          {canAccess('fulfillment', profile) ? <button onClick={() => onNavigate('fulfillment')}><i>03</i><span><b>Manage delivery</b><small>Coordinate pickup and fulfillment</small></span><strong>→</strong></button> : null}
        </div>
      </div>
      {poFile ? (
        <Suspense fallback={null}>
          <POUploadDialog file={poFile} onClose={() => setPoFile(null)} onConfirm={confirmImport} />
        </Suspense>
      ) : null}
    </section>
  );
}
