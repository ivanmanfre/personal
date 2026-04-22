import React from 'react';
import { motion } from 'framer-motion';

// Editorial artifact for Service 03 "Content that sounds like you."
// A pull-quote annotated like a footnoted book page. Shows how the voice
// model recognizes signature patterns in existing writing. Three phrases
// get accent underlines with superscript numbered footnotes; the footnote
// legend sits below in mono. One loop: underlines pulse in sequence every
// ~9s to keep alive without being frantic.

const VoiceAnnotationArtifact: React.FC = () => {
    return (
        <div className="w-full h-80 bg-paper rounded-2xl border border-[color:var(--color-hairline)] shadow-card-subtle relative overflow-hidden">

            {/* Hairline label */}
            <div className="absolute top-4 left-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1 z-20">
                Voice Model · 247 posts
            </div>

            {/* Inner paper frame to feel like a book page */}
            <div className="absolute inset-6 mt-14 flex flex-col justify-between">

                {/* Pull-quote with annotated superscript footnotes */}
                <blockquote className="font-drama italic text-lg md:text-xl leading-snug text-black px-1">
                    Most AI projects fail{' '}
                    <span className="relative inline">
                        <AnnotatedPhrase text="before the model gets involved" delay={0.1} />
                        <sup className="font-mono not-italic text-[10px] text-accent-ink ml-0.5 align-super">1</sup>
                    </span>
                    .{' '}
                    <span className="relative inline">
                        <AnnotatedPhrase text="Not because of the tech." delay={0.4} />
                        <sup className="font-mono not-italic text-[10px] text-accent-ink ml-0.5 align-super">2</sup>
                    </span>
                    {' '}Because{' '}
                    <span className="relative inline">
                        <AnnotatedPhrase text="the work underneath isn't ready" delay={0.7} />
                        <sup className="font-mono not-italic text-[10px] text-accent-ink ml-0.5 align-super">3</sup>
                    </span>
                    .
                </blockquote>

                {/* Footnote legend */}
                <div className="border-t border-[color:var(--color-hairline)] pt-3 space-y-1">
                    <FootnoteRow n="1" label="Signature thesis" delay={1.2} />
                    <FootnoteRow n="2" label="Contrarian frame" delay={1.45} />
                    <FootnoteRow n="3" label="Operator voice" delay={1.7} />
                </div>
            </div>
        </div>
    );
};

// Phrase that gets an underline drawing in on scroll, then softly pulses once
// per ~9s to keep the artifact alive without competing with copy.
const AnnotatedPhrase: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
    return (
        <span className="relative inline-block">
            <span className="relative z-10">{text}</span>
            <motion.span
                className="absolute left-0 right-0 bottom-0 h-[2px] bg-[color:var(--color-accent)] origin-left"
                initial={{ scaleX: 0, opacity: 0.9 }}
                whileInView={{
                    scaleX: [0, 1, 1, 1],
                    opacity: [0.9, 0.9, 0.5, 0.9],
                }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{
                    scaleX: {
                        duration: 9,
                        times: [0, 0.1, 0.6, 1],
                        delay,
                        repeat: Infinity,
                        ease: [0.25, 0.46, 0.45, 0.94],
                    },
                    opacity: {
                        duration: 9,
                        times: [0, 0.1, 0.6, 1],
                        delay,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    },
                }}
            />
        </span>
    );
};

const FootnoteRow: React.FC<{ n: string; label: string; delay: number }> = ({ n, label, delay }) => (
    <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay }}
        className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
    >
        <span className="text-accent-ink font-medium">{n}</span>
        <span>{label}</span>
    </motion.div>
);

export default VoiceAnnotationArtifact;
