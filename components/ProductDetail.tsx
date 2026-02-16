import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Package, ShoppingCart, Calendar, Wrench, ExternalLink, Download, FileText, Eye, Zap } from 'lucide-react';
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
    <div className="bg-white min-h-screen">
      {/* ── HERO ── */}
      <section className="pt-32 pb-16 border-b-4 border-black">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Link
              to="/store"
              className="inline-flex items-center gap-2 font-bold uppercase text-sm mb-10 hover:gap-3 transition-all border-2 border-black px-4 py-2 shadow-comic hover:shadow-comic-hover hover:-translate-y-[2px]"
            >
              <ArrowLeft size={16} /> Back to Store
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <span
              className={`inline-block text-xs font-bold uppercase px-3 py-1 border-2 border-black mb-6 ${categoryColors[product.category]} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}
            >
              n8n workflow
            </span>
            <h1 className="text-5xl md:text-7xl font-black uppercase leading-[0.9] mb-6">
              {product.name}
            </h1>
            <p className="text-2xl md:text-3xl font-bold mb-6 max-w-3xl mx-auto">
              {product.headline}
            </p>
            <p className="text-lg font-medium leading-relaxed max-w-2xl mx-auto text-gray-600 mb-10">
              {product.description}
            </p>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                onClick={() => handleBuy(mainTier)}
                className="px-10 py-5 bg-accent border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 flex items-center gap-3 font-black text-xl uppercase"
              >
                <ShoppingCart size={24} /> Get It Now — {mainTier.label}
              </button>
              <a
                href="#pricing"
                className="px-8 py-5 bg-white border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all font-bold uppercase text-sm"
              >
                See All Plans
              </a>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-gray-500">
              <span className="flex items-center gap-1.5"><Check size={14} /> Instant download</span>
              <span className="flex items-center gap-1.5"><Check size={14} /> Setup guide included</span>
              <span className="flex items-center gap-1.5"><Check size={14} /> 30-day money-back guarantee</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── WORKFLOW PREVIEW ── */}
      {product.previewImage && (
        <section className="bg-gray-950 py-12 border-b-4 border-black">
          <div className="container mx-auto px-6 max-w-6xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="flex items-center justify-center gap-2 mb-6">
                <Eye size={18} className="text-gray-400" />
                <span className="text-sm font-bold uppercase text-gray-400 tracking-widest">Workflow Preview</span>
              </div>
              <a href={product.previewImage} target="_blank" rel="noopener noreferrer" className="block border-2 border-gray-700 hover:border-accent transition-colors overflow-hidden cursor-zoom-in rounded-sm">
                <img
                  src={product.previewImage}
                  alt={`${product.name} workflow`}
                  className="w-full h-auto"
                />
              </a>
              <p className="text-center text-gray-500 text-sm font-medium mt-4">Click to view full size</p>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section className="py-20 border-b-4 border-black">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black uppercase mb-3">What It Does</h2>
              <p className="text-lg font-medium text-gray-500">Every feature built for one goal: turning calls into content.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-4 border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="w-6 h-6 bg-accent border-2 border-black flex items-center justify-center shrink-0">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <span className="font-bold">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SAMPLE OUTPUT + WHAT YOU GET ── */}
      <section className="py-20 bg-gray-50 border-b-4 border-black">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black uppercase mb-3">See The Output</h2>
              <p className="text-lg font-medium text-gray-500">Real briefs generated from a real client call.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-10 items-start">
              {/* Sample image */}
              {product.sampleImage && (
                <div className="lg:w-3/5">
                  <div className="border-2 border-black shadow-comic overflow-hidden bg-white">
                    <img
                      src={product.sampleImage}
                      alt={`${product.name} sample output`}
                      className="w-full h-auto"
                    />
                  </div>
                  {product.samplePdf && (
                    <a
                      href={product.samplePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 px-5 py-3 bg-white border-2 border-black font-bold uppercase text-sm shadow-comic hover:shadow-comic-hover hover:-translate-y-[2px] transition-all"
                    >
                      <Download size={16} /> Download Full Sample PDF
                    </a>
                  )}
                </div>
              )}

              {/* What you get */}
              <div className={product.sampleImage ? 'lg:w-2/5' : 'w-full'}>
                <div className="border-2 border-black bg-white shadow-comic p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-cyan border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Package size={16} strokeWidth={3} />
                    </div>
                    <h3 className="text-xl font-black uppercase">What You Get</h3>
                  </div>
                  <ul className="space-y-4">
                    {product.includes.map((inc, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check size={18} strokeWidth={3} className="text-green-600 shrink-0 mt-0.5" />
                        <span className="font-bold">{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Setup requirements */}
                <div className="border-2 border-black bg-white shadow-comic p-6 mt-4">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-orange-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Wrench size={16} strokeWidth={3} />
                    </div>
                    <h3 className="text-xl font-black uppercase">Requirements</h3>
                  </div>
                  <ul className="space-y-3">
                    {product.setup.map((req, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Zap size={16} className="text-orange-500 shrink-0 mt-0.5" />
                        <span className="font-medium text-gray-700">{req}</span>
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
      <section id="pricing" className="py-20 border-b-4 border-black">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black uppercase mb-3">Choose Your Plan</h2>
              <p className="text-lg font-medium text-gray-500">Same workflow. Pick the level of support you need.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {product.tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`border-2 border-black bg-white flex flex-col ${
                    tier.highlighted
                      ? 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -translate-y-2 relative'
                      : 'shadow-comic'
                  }`}
                >
                  {tier.highlighted && (
                    <div className="bg-accent border-b-2 border-black text-center py-2 font-black text-sm uppercase">
                      Most Popular
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="font-black uppercase text-lg mb-2">{tier.name}</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-black">{tier.label}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-6 flex-grow">{tier.description}</p>
                    <button
                      onClick={() => handleBuy(tier)}
                      className={`w-full px-6 py-4 border-2 border-black font-black uppercase text-sm transition-all active:shadow-none active:translate-y-1 flex items-center justify-center gap-2 ${
                        tier.highlighted
                          ? 'bg-accent shadow-comic hover:shadow-comic-hover hover:-translate-y-1'
                          : tier.id === 'custom-install'
                          ? 'bg-gray-100 shadow-comic hover:shadow-comic-hover hover:-translate-y-1'
                          : 'bg-white shadow-comic hover:shadow-comic-hover hover:-translate-y-1'
                      }`}
                    >
                      {tier.id === 'custom-install' ? (
                        <><Calendar size={18} /> Book a Call</>
                      ) : (
                        <><ShoppingCart size={18} /> Buy Now</>
                      )}
                    </button>
                    {tier.id === 'custom-install' && (
                      <p className="text-xs font-bold text-center text-gray-400 mt-2 flex items-center justify-center gap-1">
                        <ExternalLink size={10} /> Opens Calendly
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
      <section className="py-16">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-black uppercase mb-4">Stop writing briefs manually</h2>
            <p className="text-lg font-medium text-gray-600 mb-8">
              One call. 8-14 briefs. Zero busywork.
            </p>
            <button
              onClick={() => handleBuy(mainTier)}
              className="px-10 py-5 bg-accent border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 font-black text-xl uppercase inline-flex items-center gap-3"
            >
              <ShoppingCart size={24} /> Get CallBrief — {mainTier.label}
            </button>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-gray-500 mt-6">
              <span className="flex items-center gap-1.5"><Check size={14} /> Instant download</span>
              <span className="flex items-center gap-1.5"><Check size={14} /> 30-day money-back guarantee</span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default ProductDetail;
