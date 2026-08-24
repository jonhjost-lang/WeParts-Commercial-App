import { lazy, Suspense, useState } from 'react';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import HomeScreen from './components/screens/HomeScreen';
import LoadingMark from './components/ui/LoadingMark';

const PurchaseCatalogScreen = lazy(() => import('./components/screens/PurchaseCatalogScreen'));
const MyOrdersScreen = lazy(() => import('./components/screens/MyOrdersScreen'));
const OrderFulfillmentScreen = lazy(() => import('./components/screens/OrderFulfillmentScreen'));

type ScreenName = 'home' | 'catalog' | 'orders' | 'fulfillment';

function ScreenFallback() {
  return (
    <section className="screen active">
      <div className="objects-loading" role="status">
        <LoadingMark />
        Loading MPD catalog...
      </div>
    </section>
  );
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenName>('home');

  const navigate = (screen: string) => {
    setActiveScreen(screen === 'catalog' || screen === 'orders' || screen === 'fulfillment' ? screen : 'home');
  };

  return (
    <>
      <Header onNavigate={navigate} />
      <div className="app-shell">
        <Sidebar activeScreen={activeScreen} onNavigate={navigate} />
        <main className="main">
          {activeScreen === 'catalog' ? (
            <Suspense fallback={<ScreenFallback />}>
              <PurchaseCatalogScreen />
            </Suspense>
          ) : activeScreen === 'orders' ? (
            <Suspense fallback={<ScreenFallback />}><MyOrdersScreen /></Suspense>
          ) : activeScreen === 'fulfillment' ? (
            <Suspense fallback={<ScreenFallback />}><OrderFulfillmentScreen /></Suspense>
          ) : (
            <HomeScreen onNavigate={navigate} />
          )}
        </main>
      </div>
    </>
  );
}
