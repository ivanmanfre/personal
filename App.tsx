import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import StorePage from './components/StorePage';
import ProductDetail from './components/ProductDetail';
import ScrollToTop from './components/ScrollToTop';

const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));

function App() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  if (isDashboard) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <Dashboard />
      </Suspense>
    );
  }

  return (
    <div className="relative bg-paper text-black min-h-screen font-sans selection:bg-accent selection:text-black">
      <ScrollToTop />
      <Navbar />

      <main className="relative z-10 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/store/:slug" element={<ProductDetail />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
