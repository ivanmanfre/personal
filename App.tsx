import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import StorePage from './components/StorePage';
import ProductDetail from './components/ProductDetail';
import ScrollToTop from './components/ScrollToTop';

function App() {
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
