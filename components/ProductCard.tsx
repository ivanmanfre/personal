import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { Product } from '../types';

const categoryColors: Record<string, string> = {
  workflow: 'bg-accent',
  template: 'bg-cyan',
  agent: 'bg-pink',
  service: 'bg-amber-300',
};

const item: Variants = {
  hidden: { opacity: 0, y: 50, rotate: 2 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', bounce: 0.4 } },
};

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  return (
    <motion.div variants={item} whileHover={{ y: -5 }} whileTap={{ y: 0 }}>
      <Link
        to={`/store/${product.slug}`}
        className="block bg-paper border-subtle-thick p-8 shadow-card hover:shadow-card-hover active:shadow-card-active transition-all group relative overflow-hidden flex flex-col h-full"
      >
        {/* Corner decoration */}
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-t-black group-hover:scale-110 transition-transform" />

        {/* Icon */}
        <div
          className={`w-16 h-16 ${categoryColors[product.category]} border-subtle flex items-center justify-center mb-6 shadow-card-sm`}
        >
          <product.icon className="text-black" size={32} strokeWidth={2.5} />
        </div>

        {/* Preview image */}
        {product.previewImage && (
          <div className="border-subtle mb-6 overflow-hidden bg-zinc-900 p-1.5 shadow-card-sm group-hover:shadow-card-sm-hover transition-shadow">
            <img
              src={product.previewImage}
              alt={`${product.name} workflow`}
              className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-300"
            />
          </div>
        )}

        {/* Category badge */}
        <span className="text-xs font-medium uppercase border-subtle px-3 py-1 bg-white w-fit mb-4 shadow-card-sm">
          {product.category}
        </span>

        {/* Title */}
        <h3 className="text-3xl font-semibold mb-2 tracking-tight">{product.name}</h3>

        {/* Headline */}
        <p className="text-lg font-medium leading-relaxed mb-6 flex-grow text-zinc-700">
          {product.headline}
        </p>

        {/* Price + CTA */}
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 mt-auto">
          <div>
            <span className="text-xs font-medium uppercase text-zinc-500 block tracking-widest">From</span>
            <span className="text-4xl font-bold">{product.tiers[0].label}</span>
          </div>
          <span className="flex items-center gap-2 font-bold uppercase text-sm group-hover:gap-4 transition-all bg-black text-white px-4 py-2">
            Details <ArrowRight size={18} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
