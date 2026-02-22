import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { Product } from '../types';

const categoryColors: Record<string, string> = {
  workflow: 'bg-accent',
  template: 'bg-cyan',
  agent: 'bg-pink',
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
        className="block bg-paper comic-border-thick p-8 shadow-comic hover:shadow-comic-hover active:shadow-comic-active transition-all group relative overflow-hidden flex flex-col h-full"
      >
        {/* Corner decoration */}
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-t-black group-hover:scale-110 transition-transform" />

        {/* Icon */}
        <div
          className={`w-16 h-16 ${categoryColors[product.category]} comic-border flex items-center justify-center mb-6 shadow-comic-sm`}
        >
          <product.icon className="text-black" size={32} strokeWidth={2.5} />
        </div>

        {/* Preview image */}
        {product.previewImage && (
          <div className="comic-border mb-6 overflow-hidden bg-gray-900 p-1.5 shadow-comic-sm group-hover:shadow-comic-sm-hover transition-shadow">
            <img
              src={product.previewImage}
              alt={`${product.name} workflow`}
              className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-300"
            />
          </div>
        )}

        {/* Category badge */}
        <span className="text-xs font-black uppercase comic-border px-3 py-1 bg-white w-fit mb-4 shadow-comic-sm">
          {product.category}
        </span>

        {/* Title */}
        <h3 className="text-3xl font-black mb-2 uppercase tracking-tight">{product.name}</h3>

        {/* Headline */}
        <p className="text-lg font-bold leading-relaxed mb-6 flex-grow text-gray-800">
          {product.headline}
        </p>

        {/* Price + CTA */}
        <div className="flex items-center justify-between border-t-4 border-black pt-4 mt-auto">
          <div>
            <span className="text-xs font-black uppercase text-gray-500 block tracking-widest">From</span>
            <span className="text-4xl font-black">{product.tiers[0].label}</span>
          </div>
          <span className="flex items-center gap-2 font-black uppercase text-sm group-hover:gap-4 transition-all bg-black text-white px-4 py-2">
            Details <ArrowRight size={18} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
