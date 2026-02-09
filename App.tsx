import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import CaseStudies from './components/CaseStudies';
import TechStack from './components/TechStack';
import Process from './components/Process';
import About from './components/About';
import Testimonials from './components/Testimonials';
import CTA from './components/CTA';
import Footer from './components/Footer';

function App() {
  return (
    <div className="relative bg-paper text-black min-h-screen font-sans selection:bg-accent selection:text-black">
      <Navbar />

      <main className="relative z-10 flex flex-col overflow-hidden">
        <Hero />
        <Services />
        <Process />
        <CaseStudies />
        <Testimonials />
        <About />
        <TechStack />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}

export default App;