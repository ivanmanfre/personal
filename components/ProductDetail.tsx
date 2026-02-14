import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, ShoppingCart, Package } from 'lucide-react';
import { products } from '../data/products';

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

  const handleBuy = () => {
    if (product.checkoutUrl && product.checkoutUrl !== '#') {
      // LemonSqueezy overlay checkout
      (window as any).LemonSqueezy?.Url?.Open?.(product.checkoutUrl);
    }
  };

  return (
    <section className="pt-32 pb-24 bg-white min-h-screen">
      <div className="container mx-auto px-6 max-w-5xl">
        {/* Back link */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            to="/store"
            className="inline-flex items-center gap-2 font-bold uppercase text-sm mb-10 hover:gap-3 transition-all border-2 border-black px-4 py-2 shadow-comic hover:shadow-comic-hover hover:-translate-y-[2px]"
          >
            <ArrowLeft size={16} /> Back to Store
          </Link>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left: Product Info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:w-3/5"
          >
            {/* Category + Title */}
            <span
              className={`inline-block text-xs font-bold uppercase px-3 py-1 border-2 border-black mb-4 ${categoryColors[product.category]} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}
            >
              {product.category}
            </span>
            <h1 className="text-4xl md:text-6xl font-black uppercase leading-[0.9] mb-6">
              {product.name}
            </h1>
            <p className="text-xl font-bold mb-4 text-gray-700">{product.headline}</p>
            <p className="text-lg font-medium leading-relaxed mb-10 border-l-4 border-black pl-6">
              {product.description}
            </p>

            {/* Features */}
            <div className="mb-10">
              <h2 className="text-xl font-black uppercase mb-4 bg-black text-white inline-block px-3 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                What It Does
              </h2>
              <ul className="space-y-3 mt-4">
                {product.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-accent border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-lg font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Includes */}
            <div>
              <h2 className="text-xl font-black uppercase mb-4 bg-black text-white inline-block px-3 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                What You Get
              </h2>
              <ul className="space-y-3 mt-4">
                {product.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Package size={14} strokeWidth={3} />
                    </div>
                    <span className="text-lg font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Right: Buy Card (sticky) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:w-2/5"
          >
            <div className="lg:sticky lg:top-28 border-4 border-black bg-white shadow-comic p-8">
              {/* Icon */}
              <div
                className={`w-20 h-20 ${categoryColors[product.category]} border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-auto`}
              >
                <product.icon className="text-black" size={40} strokeWidth={2.5} />
              </div>

              {/* Price */}
              <div className="text-center mb-8">
                <span className="text-5xl font-black">${product.price}</span>
                <p className="text-sm font-bold uppercase text-gray-500 mt-2">One-time payment</p>
              </div>

              {/* Buy Button */}
              <button
                onClick={handleBuy}
                className="w-full px-8 py-4 bg-accent border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 flex items-center justify-center gap-3 font-black text-lg uppercase"
              >
                <ShoppingCart size={22} /> Buy Now
              </button>

              {/* Trust signals */}
              <div className="mt-6 space-y-3 text-sm font-bold text-gray-600">
                <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
                  <Check size={14} /> Instant download after purchase
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} /> Setup guide + video walkthrough
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} /> 30-day money-back guarantee
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;
