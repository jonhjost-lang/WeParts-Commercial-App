import { lazy, Suspense, useState } from 'react';

import { canAccess, HOME_SCREEN, isScreenName, type ScreenName } from './config/navigation';
import { useUserProfile } from './hooks/useUserProfile';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import HomeScreen from './components/screens/HomeScreen';
import LoadingMark from './components/ui/LoadingMark';

const PurchaseCatalogScreen = lazy(() => import('./components/screens/PurchaseCatalogScreen'));
const MyOrdersScreen = lazy(() => import('./components/screens/MyOrdersScreen'));
const OrderFulfillmentScreen = lazy(() => import('./components/screens/OrderFulfillmentScreen'));

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
  const [activeScreen, setActiveScreen] = useState<ScreenName>(HOME_SCREEN);
  const { profile } = useUserProfile();

  const navigate = (screen: string) => {
    setActiveScreen(isScreenName(screen) ? screen : HOME_SCREEN);
  };

  // Hiding a menu item is not access control: the screen itself must refuse to
  // mount. A profile that loses access while a screen is open falls back Home.
  const visibleScreen: ScreenName = canAccess(activeScreen, profile) ? activeScreen : HOME_SCREEN;

  return (
    <>
      <Header onNavigate={navigate} profile={profile} />
      <div className="app-shell">
        <Sidebar activeScreen={visibleScreen} onNavigate={navigate} profile={profile} />
        <main className="main">
          {visibleScreen === 'catalog' ? (
            <Suspense fallback={<ScreenFallback />}>
              <PurchaseCatalogScreen />
            </Suspense>
          ) : visibleScreen === 'orders' ? (
            <Suspense fallback={<ScreenFallback />}><MyOrdersScreen /></Suspense>
          ) : visibleScreen === 'fulfillment' ? (
            <Suspense fallback={<ScreenFallback />}><OrderFulfillmentScreen /></Suspense>
          ) : (
            <HomeScreen onNavigate={navigate} profile={profile} />
          )}
        </main>
      </div>
    </>
  );
}
