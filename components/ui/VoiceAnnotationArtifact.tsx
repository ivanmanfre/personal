import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

// Editorial artifact for Service 03 "Content that sounds like you."
// Shows the system drafting a post in the buyer's voice, then auto-queuing
// it. One clear loop: post title types out → body types out → voice-match
// + queue indicators light up → pause → reset. Reads "this runs itself."

const POSTS = [
    {
        topic: 'Agent-Ready Ops',
        hook: 'Most AI projects fail before the model gets involved.',
        body: "The problem isn't the tech. It's that the work underneath isn't ready for an agent to touch. Four conditions. Miss one, the build breaks in weeks.",
        day: 'Monday',
        time: '9:00 AM',
        match: 94,
    },
    {
        topic: 'Operator Notes',
        hook: 'You can\'t hire your way out of a broken process.',
        body: "Adding headcount to unstructured work compounds the problem. Structure the inputs. Document the decisions. Then automate. In that order.",
        day: 'Wednesday',
        time: '8:30 AM',
        match: 91,
    },
    {
        topic: 'Shipped',
        hook: 'Encoded how their best manager grades a call.',
        body: "Eight criteria, 1 to 5. Let the agent apply it to 100% of calls. Humans review flagged outliers. 5% sampled coverage went to 100% in two weeks.",
        day: 'Friday',
        time: '9:00 AM',
        match: 96,
    },
];

const VoiceAnnotationArtifact: React.FC = () => {
    const [postIdx, setPostIdx] = useState(0);

    // Cycle through sample posts every ~10s
    useEffect(() => {
        const timer = setInterval(() => {
            setPostIdx((i) => (i + 1) % POSTS.length);
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    const post = POSTS[postIdx];

    return (
        <div className="w-full h-80 bg-paper rounded-2xl border border-[color:var(--color-hairline)] shadow-card-subtle relative overflow-hidden">

            {/* Status chip */}
            <div className="absolute top-4 left-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1 z-20 flex items-center gap-2">
                <motion.span
                    className="inline-flex rounded-full h-1.5 w-1.5 bg-accent"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                Auto-drafted
            </div>

            {/* Post preview */}
            <div className="absolute inset-6 mt-14 flex flex-col">

                {/* Topic label */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`topic-${postIdx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute mb-2"
                    >
                        Topic · {post.topic}
                    </motion.div>
                </AnimatePresence>

                {/* Hook */}
                <AnimatePresence mode="wait">
                    <motion.p
                        key={`hook-${postIdx}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="font-drama italic text-lg md:text-xl leading-tight text-black mb-2"
                    >
                        {post.hook}
                    </motion.p>
                </AnimatePresence>

                {/* Body preview */}
                <AnimatePresence mode="wait">
                    <motion.p
                        key={`body-${postIdx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, delay: 0.25 }}
                        className="text-sm text-ink-soft leading-relaxed line-clamp-3 mb-auto"
                    >
                        {post.body}
                    </motion.p>
                </AnimatePresence>

                {/* Indicators */}
                <div className="mt-4 pt-3 border-t border-[color:var(--color-hairline)] flex items-center justify-between gap-2 flex-wrap">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`match-${postIdx}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, delay: 0.4 }}
                            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft"
                        >
                            Voice match · <span className="text-accent-ink font-medium">{post.match}%</span>
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`queue-${postIdx}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, delay: 0.55 }}
                            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft flex items-center gap-1.5"
                        >
                            <Check size={10} className="text-accent-ink" strokeWidth={3} />
                            Queued · {post.day} {post.time}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default VoiceAnnotationArtifact;
