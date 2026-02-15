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
    <motion.div variants={item}>
      <Link
        to={`/store/${product.slug}`}
        className="block bg-white border-2 border-black p-8 shadow-comic hover:shadow-comic-hover transition-all hover:-translate-y-2 group relative overflow-hidden flex flex-col h-full"
      >
        {/* Corner decoration */}
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[50px] border-l-transparent border-t-[50px] border-t-black group-hover:scale-110 transition-transform" />

        {/* Icon */}
        <div
          className={`w-16 h-16 ${categoryColors[product.category]} border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
        >
          <product.icon className="text-black" size={32} strokeWidth={2.5} />
        </div>

        {/* Category badge */}
        <span className="text-xs font-bold uppercase border border-black px-2 py-1 bg-gray-100 w-fit mb-4">
          {product.category}
        </span>

        {/* Title */}
        <h3 className="text-2xl font-black mb-2 uppercase">{product.name}</h3>

        {/* Headline */}
        <p className="text-lg font-medium leading-relaxed mb-6 flex-grow">
          {product.headline}
        </p>

        {/* Price + CTA */}
        <div className="flex items-center justify-between border-t-2 border-black pt-4 mt-auto">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500 block">From</span>
            <span className="text-3xl font-black">{product.tiers[0].label}</span>
          </div>
          <span className="flex items-center gap-2 font-bold uppercase text-sm group-hover:gap-3 transition-all">
            View Details <ArrowRight size={16} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
