import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ease = [0.22, 0.84, 0.36, 1] as const;

const CTA: React.FC = () => {
  return (
    <section className="py-24 border-t relative overflow-hidden" style={{ borderColor: 'rgba(26,26,26,0.1)' }}>
      <div className="container mx-auto px-8 max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85, ease }}
          className="text-center"
        >
          <div className="w-8 h-0.5 mx-auto mb-10" style={{ backgroundColor: 'var(--color-accent)' }} />
          <h2
            style={{
              fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
              fontWeight: 400,
              fontSize: 'clamp(2.6rem, 5.5vw, 5rem)',
              lineHeight: 1.04,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
              marginBottom: '1.5rem',
            }}
          >
            Ready to grow<br />
            <span style={{ fontStyle: 'italic' }}>without hiring?</span>
          </h2>
          <p
            className="max-w-xl mx-auto"
            style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.7,
              color: '#3D3D3B',
              marginBottom: '2.5rem',
            }}
          >
            A 1-week diagnostic. I evaluate your operation against the 4 preconditions, then hand back your 90-Day AI Rollout Plan: sequenced builds, costed gaps, decision logic for the first project.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/assessment"
              className="inline-flex items-center gap-2.5 px-8 py-4"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
                fontSize: '17px',
                backgroundColor: '#1A1A1A',
                color: '#F7F4EF',
              }}
            >
              Build your Blueprint <ArrowRight size={18} />
            </a>
            <a
              href="/start"
              className="inline-flex items-center gap-2 px-8 py-4 transition-colors"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
                fontStyle: 'italic',
                fontSize: '16px',
                color: 'rgba(26,26,26,0.55)',
                border: '1px solid rgba(26,26,26,0.14)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.55)')}
            >
              Or book a call to discuss <ArrowRight size={15} />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
