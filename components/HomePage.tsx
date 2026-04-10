import React from 'react';
import Hero from './Hero';
import Services from './Services';
import CaseStudies from './CaseStudies';
import Process from './Process';
import About from './About';
import Testimonials from './Testimonials';
import ROI from './ROI';
import CTA from './CTA';

const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <Services />
      <Process />
      <CaseStudies />
      <Testimonials />
      <About />
      <ROI />
      <CTA />
    </>
  );
};

export default HomePage;
