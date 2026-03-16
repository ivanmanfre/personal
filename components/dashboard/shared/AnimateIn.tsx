import React from 'react';

interface Props {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** Wrap a block to fade-up on mount with an optional stagger delay */
const AnimateIn: React.FC<Props> = ({ children, delay = 0, className = '' }) => (
  <div className={`animate-card-enter ${className}`} style={{ animationDelay: `${delay}ms` }}>
    {children}
  </div>
);

export default AnimateIn;
