import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Package, ShoppingCart, Calendar, Wrench, ExternalLink, Download, FileText, Eye, Zap } from 'lucide-react';
import Marquee from './Marquee';
import { products } from '../data/products';
import { PricingTier } from '../types';

const categoryColors: Record<string, string> = {
  workflow: 'bg-accent',
  template: 'bg-cyan',
  agent: 'bg-pink',
};

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const product = products.find((p) => p.slug === slug);

  if (!product) {
    return <Navigate to="/store" replace />;
  }

  const mainTier = product.tiers.find((t) => t.highlighted) || product.tiers[0];

  const handleBuy = (tier: PricingTier) => {
    if (!tier.checkoutUrl || tier.checkoutUrl === '#') return;

    if (tier.id === 'custom-install') {
      window.open(tier.checkoutUrl, '_blank');
    } else {
      (window as any).LemonSqueezy?.Url?.Open?.(tier.checkoutUrl);
    }
  };

  return (
    <div className="bg-paper min-h-screen pt-20">

      {/* ── HERO ── */}
      <section className="pt-20 pb-20 border-b-4 border-black relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none z-0"></div>
        <div className="container mx-auto px-6 max-w-5xl relative z-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Link
              to="/store"
              className="inline-flex items-center gap-2 font-black uppercase text-sm mb-12 hover:gap-4 transition-all comic-border px-5 py-3 shadow-comic-sm bg-white hover:shadow-comic-sm-hover hover:-translate-y-1 active:translate-y-0 active:shadow-comic-sm-active"
            >
              <ArrowLeft size={18} strokeWidth={3} /> Back to Store
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center relative">
            <span
              className={`inline-block text-sm font-black uppercase tracking-widest px-4 py-2 comic-border mb-8 ${categoryColors[product.category]} shadow-comic-sm -rotate-2 transform`}
            >
              {product.category}
            </span>
            <h1 className="text-6xl md:text-8xl font-black uppercase leading-[0.85] tracking-tighter mb-8">
              {product.name}
            </h1>
            <p className="text-3xl md:text-4xl font-bold mb-8 max-w-4xl mx-auto tracking-tight">
              {product.headline}
            </p>
            <p className="text-xl font-medium leading-relaxed max-w-2xl mx-auto text-gray-800 mb-12">
              {product.description}
            </p>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
              <button
                onClick={() => handleBuy(mainTier)}
                className="w-full sm:w-auto px-10 py-5 bg-accent comic-border-thick shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-comic-active active:translate-y-1 flex items-center justify-center gap-3 font-black text-xl lg:text-2xl uppercase tracking-wide"
              >
                <ShoppingCart size={28} strokeWidth={2.5} /> Get It Now | {mainTier.label}
              </button>
              <a
                href="#pricing"
                className="w-full sm:w-auto px-10 py-5 bg-white comic-border-thick shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-comic-active active:translate-y-1 font-black uppercase text-lg lg:text-class tracking-wide text-center"
              >
                See All Plans
              </a>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-black uppercase tracking-widest text-gray-800">
              <span className="flex items-center gap-2"><Check size={18} strokeWidth={3} className="text-green-500" /> Instant download</span>
              <span className="flex items-center gap-2"><Check size={18} strokeWidth={3} className="text-green-500" /> Setup guide included</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Decorative Marquee Divider */}
      <div className="w-full bg-cyan border-b-4 border-black py-3 border-t-0 shadow-sm relative z-20">
        <Marquee speed={25} className="font-black text-lg uppercase tracking-widest text-black">
          <span className="mx-6">Plug & Play</span>
          <span className="mx-6">•</span>
          <span className="mx-6">No Subscriptions</span>
          <span className="mx-6">•</span>
          <span className="mx-6">Full Ownership</span>
          <span className="mx-6">•</span>
        </Marquee>
      </div>

      {/* ── WORKFLOW PREVIEW ── */}
      {product.previewImage && (
        <section className="bg-gray-900 py-16 border-b-4 border-black relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"1\" fill-rule=\"evenodd\"%3E%3Ccircle cx=\"3\" cy=\"3\" r=\"3\"/%3E%3Ccircle cx=\"13\" cy=\"13\" r=\"3\"/%3E%3C/g%3E%3C/svg%3E')" }}></div>
          <div className="container mx-auto px-6 max-w-6xl relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="flex justify-center mb-8">
                <span className="inline-flex items-center gap-3 px-6 py-2 bg-black text-white comic-border shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] font-black uppercase tracking-widest text-sm">
                  <Eye size={20} /> Workflow Overview
                </span>
              </div>
              <a href={product.previewImage} target="_blank" rel="noopener noreferrer" className="block comic-border-thick bg-black p-2 hover:p-1 transition-all group shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                <img
                  src={product.previewImage}
                  alt={`${product.name} workflow`}
                  className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-300"
                />
              </a>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section className="py-24 border-b-4 border-black bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-black uppercase mb-4 tracking-tighter">What It Does</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {product.features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-4 p-6 comic-border bg-paper shadow-comic-sm hover:-translate-y-1 hover:shadow-comic-sm-hover transition-all"
                >
                  <div className="w-8 h-8 bg-accent comic-border flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={20} strokeWidth={3} />
                  </div>
                  <span className="font-bold text-lg leading-snug">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SAMPLE OUTPUT + WHAT YOU GET ── */}
      <section className="py-24 bg-pink/10 border-b-4 border-black bg-grid-pattern relative">
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>

            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-black uppercase mb-4 tracking-tighter">Inside The Box</h2>
            </div>

            <div className="flex flex-col lg:flex-row gap-12 items-start">
              {/* Sample image */}
              {product.sampleImage && (
                <div className="lg:w-3/5">
                  <div className="comic-border-thick bg-white p-2 shadow-comic">
                    <img
                      src={product.sampleImage}
                      alt={`${product.name} sample output`}
                      className="w-full h-auto border-2 border-dashed border-gray-300"
                    />
                  </div>
                  {product.samplePdf && (
                    <a
                      href={product.samplePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full gap-3 mt-8 px-6 py-4 bg-white comic-border font-black uppercase tracking-wide text-lg shadow-comic-sm hover:shadow-comic-sm-hover hover:-translate-y-1 transition-all active:translate-y-0 active:shadow-comic-sm-active text-center"
                    >
                      <Download size={24} strokeWidth={2.5} /> Download Full Sample PDF
                    </a>
                  )}
                </div>
              )}

              {/* What you get */}
              <div className={product.sampleImage ? 'lg:w-2/5' : 'w-full'}>
                <div className="comic-border bg-white shadow-comic p-8">
                  <div className="flex items-center gap-4 mb-8 border-b-4 border-black pb-4">
                    <div className="w-12 h-12 bg-cyan comic-border flex items-center justify-center shadow-comic-sm">
                      <Package size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tight">Included</h3>
                  </div>
                  <ul className="space-y-4">
                    {product.includes.map((inc, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check size={24} strokeWidth={3} className="text-green-500 shrink-0 mt-1" />
                        <span className="font-bold text-lg">{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Setup requirements */}
                <div className="comic-border bg-white shadow-comic p-8 mt-8">
                  <div className="flex items-center gap-4 mb-8 border-b-4 border-black pb-4">
                    <div className="w-12 h-12 bg-orange-400 comic-border flex items-center justify-center shadow-comic-sm">
                      <Wrench size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tight">Required</h3>
                  </div>
                  <ul className="space-y-4">
                    {product.setup.map((req, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-black shrink-0"></div>
                        <span className="font-bold text-lg text-gray-800">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 border-b-4 border-black bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-black uppercase mb-4 tracking-tighter">Choose Your Plan</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {product.tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`comic-border-thick bg-paper flex flex-col relative transition-transform ${tier.highlighted
                    ? 'shadow-comic hover:shadow-comic-hover -translate-y-2 hover:-translate-y-4 md:scale-105 z-10'
                    : 'shadow-comic-sm hover:shadow-comic-sm-hover hover:-translate-y-1'
                    }`}
                >
                  {tier.highlighted && (
                    <div className="bg-accent border-b-4 border-black text-center py-3 font-black tracking-widest text-sm uppercase">
                      Most Popular
                    </div>
                  )}
                  <div className="p-8 flex flex-col flex-grow">
                    <h3 className="font-black uppercase text-2xl mb-4 tracking-tight">{tier.name}</h3>
                    <div className="mb-6">
                      <span className="text-5xl font-black">{tier.label}</span>
                    </div>
                    <p className="font-bold text-gray-700 leading-relaxed mb-8 flex-grow">{tier.description}</p>
                    <button
                      onClick={() => handleBuy(tier)}
                      className={`w-full px-6 py-5 comic-border font-black uppercase text-lg tracking-wide transition-all active:shadow-comic-active active:translate-y-1 flex items-center justify-center gap-3 ${tier.highlighted
                        ? 'bg-accent shadow-comic hover:shadow-comic-hover hover:-translate-y-1'
                        : tier.id === 'custom-install'
                          ? 'bg-gray-100 shadow-comic-sm hover:shadow-comic-sm-hover hover:-translate-y-1'
                          : 'bg-white shadow-comic-sm hover:shadow-comic-sm-hover hover:-translate-y-1'
                        }`}
                    >
                      {tier.id === 'custom-install' ? (
                        <><Calendar size={24} strokeWidth={2.5} /> Book a Call</>
                      ) : (
                        <><ShoppingCart size={24} strokeWidth={2.5} /> Buy Now</>
                      )}
                    </button>
                    {tier.id === 'custom-install' && (
                      <p className="text-xs font-black uppercase tracking-widest text-center text-gray-400 mt-4 flex items-center justify-center gap-2">
                        <ExternalLink size={14} strokeWidth={3} /> Opens Calendly
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 bg-accent relative overflow-hidden">
        {/* Background stripes */}
        <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(0,0,0,0.05) 20px, rgba(0,0,0,0.05) 40px)" }}></div>
        <div className="container mx-auto px-6 max-w-4xl text-center relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <h2 className="text-5xl md:text-7xl font-black uppercase mb-8 tracking-tighter bg-white text-black inline-block px-6 py-4 comic-border shadow-comic rotate-1 transform">
              Ready to Upgrade?
            </h2>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => handleBuy(mainTier)}
                className="px-12 py-6 bg-black text-white comic-border-thick shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-2 transition-all active:shadow-[0px_0px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 font-black text-2xl md:text-3xl uppercase tracking-wide inline-flex items-center gap-4"
              >
                <ShoppingCart size={32} strokeWidth={3} /> Get {product.name}
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default ProductDetail;
