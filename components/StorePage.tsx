import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import ProductCard from './ProductCard';
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
    <section className="pt-32 pb-24 bg-white min-h-screen">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 border-b-4 border-black pb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-accent border-2 border-black flex items-center justify-center shadow-comic">
              <ShoppingBag size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase leading-none">Store</h1>
          </div>
          <p className="text-xl font-medium max-w-2xl text-gray-700">
            Pre-built automation systems ready to deploy. Each product includes the workflow files, setup guide, and video walkthrough.
          </p>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-3 mb-12"
        >
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as 'all' | ProductCategory)}
              className={`px-5 py-2 border-2 border-black font-bold uppercase text-sm transition-all ${
                activeCategory === key
                  ? 'bg-black text-white shadow-none translate-x-[2px] translate-y-[2px]'
                  : 'bg-white shadow-comic hover:shadow-comic-hover hover:-translate-y-[2px]'
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
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {filtered.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </motion.div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-gray-300">
            <p className="text-xl font-bold text-gray-400 uppercase">No products in this category yet</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default StorePage;
