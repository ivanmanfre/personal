import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Package, ShoppingCart, Calendar, Wrench, ExternalLink, Download, FileText, Eye, Zap } from 'lucide-react';
import Marquee from './Marquee';
import { products } from '../data/products';
import { Product, PricingTier } from '../types';

// Parses "text {{italic:pivot word}} more text" into Grotesk + DM Serif italic spans.
// Brand rule: italic DM Serif on the emotional pivot inside a Grotesk headline.
const renderPivot = (text: string): React.ReactNode => {
  const parts = text.split(/(\{\{italic:[^}]+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{\{italic:([^}]+)\}\}$/);
    if (match) {
      return (
        <em key={i} className="font-drama italic font-normal tracking-normal">
          {match[1]}
        </em>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const categoryColors: Record<string, string> = {
  workflow: 'bg-accent',
  template: 'bg-cyan',
  agent: 'bg-pink',
  service: 'bg-amber-300',
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

    const isLemon = tier.checkoutUrl.includes('lemonsqueezy.com');
    if (isLemon) {
      (window as any).LemonSqueezy?.Url?.Open?.(tier.checkoutUrl);
    } else {
      window.open(tier.checkoutUrl, '_blank');
    }
  };

  if (product.category === 'service') {
    return <ServiceDetail product={product} onBuy={handleBuy} />;
  }

  return (
    <div className="bg-paper min-h-screen pt-20">

      {/* ── HERO ── */}
      <section className="pt-20 pb-20 border-b border-zinc-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none z-0"></div>
        <div className="container mx-auto px-6 max-w-5xl relative z-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Link
              to="/store"
              className="inline-flex items-center gap-2 font-bold uppercase text-sm mb-12 hover:gap-4 transition-all border-subtle px-5 py-3 shadow-card-sm bg-white hover:shadow-card-sm-hover hover:-translate-y-1 active:translate-y-0 active:shadow-card-sm-active"
            >
              <ArrowLeft size={18} strokeWidth={3} /> Back to Store
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center relative">
            <span
              className={`inline-block text-sm font-bold uppercase tracking-widest px-4 py-2 border-subtle mb-8 ${categoryColors[product.category]} shadow-card-sm`}
            >
              {product.category}
            </span>
            <h1 className="text-6xl md:text-8xl font-bold leading-[0.85] tracking-tighter mb-8">
              {product.name}
            </h1>
            <p className="text-3xl md:text-4xl font-bold mb-8 max-w-4xl mx-auto tracking-tight">
              {product.headline}
            </p>
            <p className="text-xl font-medium leading-relaxed max-w-2xl mx-auto text-zinc-700 mb-12">
              {product.description}
            </p>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
              <button
                onClick={() => handleBuy(mainTier)}
                className="w-full sm:w-auto px-10 py-5 bg-accent border-subtle-thick shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all active:shadow-card-active active:translate-y-1 flex items-center justify-center gap-3 font-bold text-xl lg:text-2xl uppercase tracking-wide"
              >
                <ShoppingCart size={28} strokeWidth={2.5} /> Get It Now | {mainTier.label}
              </button>
              <a
                href="#pricing"
                className="w-full sm:w-auto px-10 py-5 bg-white border-subtle-thick shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all active:shadow-card-active active:translate-y-1 font-bold uppercase text-lg lg:text-class tracking-wide text-center"
              >
                See All Plans
              </a>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-bold uppercase tracking-widest text-zinc-700">
              <span className="flex items-center gap-2"><Check size={18} strokeWidth={3} className="text-green-500" /> Instant download</span>
              <span className="flex items-center gap-2"><Check size={18} strokeWidth={3} className="text-green-500" /> Setup guide included</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Decorative Marquee Divider */}
      <div className="w-full bg-cyan border-b border-zinc-200 py-3 border-t-0 shadow-sm relative z-20">
        <Marquee speed={25} className="font-bold text-lg uppercase tracking-widest text-black">
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
        <section className="bg-zinc-900 py-16 border-b border-zinc-200 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"1\" fill-rule=\"evenodd\"%3E%3Ccircle cx=\"3\" cy=\"3\" r=\"3\"/%3E%3Ccircle cx=\"13\" cy=\"13\" r=\"3\"/%3E%3C/g%3E%3C/svg%3E')" }}></div>
          <div className="container mx-auto px-6 max-w-6xl relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="flex justify-center mb-8">
                <span className="inline-flex items-center gap-3 px-6 py-2 bg-black text-white border-subtle shadow-md font-bold uppercase tracking-widest text-sm">
                  <Eye size={20} /> Workflow Overview
                </span>
              </div>
              <a href={product.previewImage} target="_blank" rel="noopener noreferrer" className="block border-subtle-thick bg-black p-2 hover:p-1 transition-all group shadow-lg">
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
      <section className="py-24 border-b border-zinc-200 bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold mb-4 tracking-tighter">What It Does</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {product.features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-4 p-6 border-subtle bg-paper shadow-card-sm hover:-translate-y-1 hover:shadow-card-sm-hover transition-all"
                >
                  <div className="w-8 h-8 bg-accent border-subtle flex items-center justify-center shrink-0 mt-0.5">
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
      <section className="py-24 bg-pink/10 border-b border-zinc-200 bg-grid-pattern relative">
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>

            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold mb-4 tracking-tighter">Inside The Box</h2>
            </div>

            <div className="flex flex-col lg:flex-row gap-12 items-start">
              {/* Sample image */}
              {product.sampleImage && (
                <div className="lg:w-3/5">
                  <div className="border-subtle-thick bg-white p-2 shadow-card">
                    <img
                      src={product.sampleImage}
                      alt={`${product.name} sample output`}
                      className="w-full h-auto border-2 border-dashed border-zinc-300"
                    />
                  </div>
                  {product.samplePdf && (
                    <a
                      href={product.samplePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full gap-3 mt-8 px-6 py-4 bg-white border-subtle font-bold uppercase tracking-wide text-lg shadow-card-sm hover:shadow-card-sm-hover hover:-translate-y-1 transition-all active:translate-y-0 active:shadow-card-sm-active text-center"
                    >
                      <Download size={24} strokeWidth={2.5} /> Download Full Sample PDF
                    </a>
                  )}
                </div>
              )}

              {/* What you get */}
              <div className={product.sampleImage ? 'lg:w-2/5' : 'w-full'}>
                <div className="border-subtle bg-white shadow-card p-8">
                  <div className="flex items-center gap-4 mb-8 border-b border-zinc-200 pb-4">
                    <div className="w-12 h-12 bg-cyan border-subtle flex items-center justify-center shadow-card-sm">
                      <Package size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-3xl font-semibold uppercase tracking-tight">Included</h3>
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
                <div className="border-subtle bg-white shadow-card p-8 mt-8">
                  <div className="flex items-center gap-4 mb-8 border-b border-zinc-200 pb-4">
                    <div className="w-12 h-12 bg-orange-400 border-subtle flex items-center justify-center shadow-card-sm">
                      <Wrench size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-3xl font-semibold uppercase tracking-tight">Required</h3>
                  </div>
                  <ul className="space-y-4">
                    {product.setup.map((req, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-black shrink-0"></div>
                        <span className="font-bold text-lg text-zinc-700">{req}</span>
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
      <section id="pricing" className="py-24 border-b border-zinc-200 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold mb-4 tracking-tighter">Choose Your Plan</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {product.tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`border-subtle-thick bg-paper flex flex-col relative transition-transform ${tier.highlighted
                    ? 'shadow-card hover:shadow-card-hover -translate-y-2 hover:-translate-y-4 md:scale-105 z-10'
                    : 'shadow-card-sm hover:shadow-card-sm-hover hover:-translate-y-1'
                    }`}
                >
                  {tier.highlighted && (
                    <div className="bg-accent border-b border-zinc-200 text-center py-3 font-bold tracking-widest text-sm uppercase">
                      Most Popular
                    </div>
                  )}
                  <div className="p-8 flex flex-col flex-grow">
                    <h3 className="font-semibold uppercase text-2xl mb-4 tracking-tight">{tier.name}</h3>
                    <div className="mb-6">
                      <span className="text-5xl font-bold">{tier.label}</span>
                    </div>
                    <p className="font-bold text-zinc-600 leading-relaxed mb-8 flex-grow">{tier.description}</p>
                    <button
                      onClick={() => handleBuy(tier)}
                      className={`w-full px-6 py-5 border-subtle font-bold uppercase text-lg tracking-wide transition-all active:shadow-card-active active:translate-y-1 flex items-center justify-center gap-3 ${tier.highlighted
                        ? 'bg-accent shadow-card hover:shadow-card-hover hover:-translate-y-1'
                        : tier.id === 'custom-install'
                          ? 'bg-zinc-100 shadow-card-sm hover:shadow-card-sm-hover hover:-translate-y-1'
                          : 'bg-white shadow-card-sm hover:shadow-card-sm-hover hover:-translate-y-1'
                        }`}
                    >
                      {tier.id === 'custom-install' ? (
                        <><Calendar size={24} strokeWidth={2.5} /> Book a Call</>
                      ) : (
                        <><ShoppingCart size={24} strokeWidth={2.5} /> Buy Now</>
                      )}
                    </button>
                    {tier.id === 'custom-install' && (
                      <p className="text-xs font-bold uppercase tracking-widest text-center text-zinc-400 mt-4 flex items-center justify-center gap-2">
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
            <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tighter bg-white text-black inline-block px-6 py-4 border-subtle shadow-card">
              Ready to Upgrade?
            </h2>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => handleBuy(mainTier)}
                className="px-12 py-6 bg-black text-white border-subtle-thick shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all active:shadow-sm active:translate-y-0 font-bold text-2xl md:text-3xl tracking-wide inline-flex items-center gap-4"
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

// ─────────────────────────────────────────────────────────
// Editorial service layout (category === 'service').
// Brand: warm paper + sage punctuation + Grotesk/DM Serif + asymmetric.
// ─────────────────────────────────────────────────────────

const ServiceDetail: React.FC<{ product: Product; onBuy: (tier: PricingTier) => void }> = ({ product, onBuy }) => {
  const tier = product.tiers.find((t) => t.highlighted) || product.tiers[0];

  return (
    <div className="bg-paper min-h-screen">
      {/* Back link — minimal, editorial */}
      <div className="container mx-auto px-6 max-w-6xl pt-28">
        <Link
          to="/store"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-600 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} /> Store
        </Link>
      </div>

      {/* ── HERO — asymmetric 7/5 grid ── */}
      <section className="pt-12 pb-24">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start"
          >
            {/* LEFT: Headline block (7 cols) */}
            <div className="lg:col-span-7">
              <span className="inline-block bg-black text-white px-3 py-1.5 mb-8 font-mono text-xs font-bold uppercase tracking-widest">
                Orientation Session · 01
              </span>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tighter mb-10">
                {renderPivot(product.headline)}
              </h1>
              <div className="pr-4 border-r-2 border-[color:var(--color-accent)] pl-0 pr-6 mb-10 ml-auto max-w-md text-right hidden lg:block">
                <p className="font-drama italic text-xl text-zinc-700 leading-snug">
                  One call. A real plan. No fluff.
                </p>
              </div>
              <p className="text-lg md:text-xl leading-relaxed text-zinc-700 max-w-2xl mb-10 font-medium">
                {product.description}
              </p>
            </div>

            {/* RIGHT: Pricing card (5 cols) */}
            <div className="lg:col-span-5 lg:sticky lg:top-28">
              <div className="bg-white border border-zinc-200 shadow-card p-10">
                <div className="border-b border-zinc-200 pb-6 mb-6">
                  <div className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    Investment
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-drama italic text-7xl leading-none">${tier.price}</span>
                    <span className="font-mono text-sm text-zinc-500 uppercase tracking-widest">flat</span>
                  </div>
                </div>
                <p className="text-base leading-relaxed text-zinc-700 mb-8 font-medium">
                  {tier.description}
                </p>
                <button
                  onClick={() => onBuy(tier)}
                  className="w-full bg-black text-white px-6 py-5 font-bold uppercase tracking-wide text-base shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
                >
                  Book the Session <ArrowLeft size={18} strokeWidth={3} className="rotate-180" />
                </button>
                <div className="mt-6 pt-6 border-t border-zinc-200 space-y-3">
                  {product.includes.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-[color:var(--color-accent)] mt-2 shrink-0"></div>
                      <span className="text-sm font-medium text-zinc-700 leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Thin divider */}
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="border-t border-zinc-200"></div>
      </div>

      {/* ── 02 — WHAT WE MAP ── */}
      <EditorialSection number="02" title="What we map" pivot="map">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
          {product.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="w-2.5 h-2.5 bg-[color:var(--color-accent)] mt-2.5 shrink-0"></div>
              <span className="text-lg font-medium leading-snug text-zinc-800">{feature}</span>
            </li>
          ))}
        </ul>
      </EditorialSection>

      {/* ── 03 — WHAT YOU LEAVE WITH ── */}
      <EditorialSection number="03" title="What you leave with" pivot="leave">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-start">
          <div>
            <ul className="space-y-6">
              {product.includes.map((inc, i) => (
                <li key={i} className="flex items-start gap-4 border-b border-zinc-200 pb-5 last:border-b-0">
                  <span className="font-mono text-xs font-bold text-zinc-400 mt-1.5 shrink-0">
                    0{i + 1}
                  </span>
                  <span className="text-lg font-medium leading-snug">{inc}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:pl-8 lg:border-l-2 lg:border-[color:var(--color-accent)]">
            <p className="font-drama italic text-2xl md:text-3xl leading-snug text-zinc-800">
              A written plan — not a generic tutorial.
            </p>
            <p className="mt-6 text-base text-zinc-600 leading-relaxed font-medium">
              You leave with specifics: tools to set up, what to learn first, and the honest call on what to build vs. what to leave alone.
            </p>
          </div>
        </div>
      </EditorialSection>

      {/* ── 04 — WHO THIS IS FOR ── */}
      <EditorialSection number="04" title="Who this is for" pivot="for">
        <ul className="space-y-5 max-w-3xl">
          {product.setup.map((req, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="w-2.5 h-2.5 bg-[color:var(--color-accent)] mt-2.5 shrink-0"></div>
              <span className="text-lg font-medium leading-snug text-zinc-800">{req}</span>
            </li>
          ))}
        </ul>
      </EditorialSection>

      {/* ── FINAL CTA — solid black block, sage punctuation ── */}
      <section className="pb-32 pt-8">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-12 md:p-16 lg:p-20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
              <div className="lg:col-span-8">
                <span className="inline-block font-mono text-xs font-bold uppercase tracking-widest text-[color:var(--color-accent)] mb-6">
                  Ready to start
                </span>
                <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[0.95] tracking-tighter">
                  Know where to {renderPivot('{{italic:start}}')} with AI in your business.
                </h2>
              </div>
              <div className="lg:col-span-4 lg:text-right">
                <button
                  onClick={() => onBuy(tier)}
                  className="w-full lg:w-auto bg-[color:var(--color-accent)] text-black px-10 py-5 font-bold uppercase tracking-wide text-base shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all inline-flex items-center justify-center gap-3"
                >
                  Book · ${tier.price}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

// Reusable section with numbered black pill + Grotesk/DM Serif title.
const EditorialSection: React.FC<{
  number: string;
  title: string;
  pivot: string;
  children: React.ReactNode;
}> = ({ number, title, pivot, children }) => {
  const titleParts = title.split(new RegExp(`(${pivot})`, 'i'));

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-baseline gap-6 mb-12">
            <span className="bg-black text-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest shrink-0">
              {number}
            </span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[0.95] tracking-tighter">
              {titleParts.map((part, i) =>
                part.toLowerCase() === pivot.toLowerCase() ? (
                  <em key={i} className="font-drama italic font-normal tracking-normal">
                    {part}
                  </em>
                ) : (
                  <React.Fragment key={i}>{part}</React.Fragment>
                )
              )}
            </h2>
          </div>
          {children}
        </motion.div>
      </div>
    </section>
  );
};
