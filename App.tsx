import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import StorePage from './components/StorePage';
import ProductDetail from './components/ProductDetail';
import AssessmentPage from './components/AssessmentPage';
import StartPage from './components/StartPage';
import ScrollToTop from './components/ScrollToTop';

const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const VideoViewer = lazy(() => import('./components/VideoViewer'));

function App() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const isViewer = location.pathname.startsWith('/v/');

  // Public video viewer — full-screen, no nav/footer
  if (isViewer) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      }>
        <Routes>
          <Route path="/v/:token" element={<VideoViewer />} />
        </Routes>
      </Suspense>
    );
  }

  if (isDashboard) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/25 animate-pulse">
              IS
            </div>
            <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500/60 rounded-full animate-loading-bar" />
            </div>
          </div>
        </div>
      }>
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
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/store/:slug" element={<ProductDetail />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
