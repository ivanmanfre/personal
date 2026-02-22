import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import ProductCard from './ProductCard';
import Marquee from './Marquee';
import { products, categoryLabels } from '../data/products';
import { ProductCategory } from '../types';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const StorePage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | ProductCategory>('all');

  const filtered =
    activeCategory === 'all'
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Decorative Top Marquee */}
      <div className="w-full bg-accent border-b-4 border-black py-2 pt-24 z-10 hidden md:block">
        <Marquee speed={20} className="font-black text-sm uppercase tracking-widest text-black">
          <span className="mx-4">Build Fast</span>
          <span className="mx-4">•</span>
          <span className="mx-4">Ship Faster</span>
          <span className="mx-4">•</span>
          <span className="mx-4">Automate Everything</span>
          <span className="mx-4">•</span>
        </Marquee>
      </div>

      <section className="pt-24 md:pt-16 pb-24 bg-paper flex-grow bg-grid-pattern relative z-0">
        <div className="container mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16 border-b-4 border-black pb-10"
          >
            <div className="flex items-center gap-6 mb-6">
              <div className="w-16 h-16 bg-accent comic-border flex items-center justify-center shadow-comic-sm">
                <ShoppingBag size={32} strokeWidth={3} className="text-black" />
              </div>
              <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-outline-sm">Store</h1>
            </div>
            <p className="text-2xl font-bold max-w-2xl text-gray-800 leading-relaxed">
              Pre-built automation systems ready to deploy. Each product includes the workflow files and setup guide.
            </p>
          </motion.div>

          {/* Category Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-4 mb-16"
          >
            {Object.entries(categoryLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key as 'all' | ProductCategory)}
                className={`px-6 py-3 comic-border font-black uppercase text-sm tracking-widest transition-all ${activeCategory === key
                    ? 'bg-black text-white shadow-none translate-x-[2px] translate-y-[2px]'
                    : 'bg-white shadow-comic-sm hover:shadow-comic-sm-hover hover:-translate-y-1'
                  }`}
              >
                {label}
              </button>
            ))}
          </motion.div>

          {/* Product Grid */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            key={activeCategory}
            className="grid grid-cols-1 lg:grid-cols-2 gap-10"
          >
            {filtered.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </motion.div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="text-center py-20 comic-border bg-white shadow-comic">
              <p className="text-2xl font-black text-gray-400 uppercase">No products here yet</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default StorePage;
