import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { ShopProvider } from './ctx';
import { Header } from './ui/Header';
import { CartDrawer } from './ui/CartDrawer';
import { Footer } from './ui/Footer';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Checkout } from './pages/Checkout';
import { Order } from './pages/Order';

const Product = lazy(() => import('./pages/Product'));
const Admin = lazy(() => import('./admin/Admin'));
const Stills = lazy(() => import('./pages/Stills'));

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Site() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return <Suspense fallback={null}><Routes><Route path="/admin/*" element={<Admin />} /></Routes></Suspense>;
  if (pathname === '/__stills') return <Suspense fallback={null}><Stills /></Suspense>;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Suspense fallback={<div className="page-pad" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/p/:id" element={<Product />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:code" element={<Order />} />
            <Route path="*" element={<Shop />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}

export function App() {
  return (
    <ShopProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ScrollTop />
        <Site />
      </BrowserRouter>
    </ShopProvider>
  );
}
