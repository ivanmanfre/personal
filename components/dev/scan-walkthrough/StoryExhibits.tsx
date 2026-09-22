import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { founder } from './data';

const ease = [0.22, 0.84, 0.36, 1] as const;

/** The proposed artifacts stay visibly separate from published client work. */
export function ResearchArtifact({ moment }: { moment: number }) {
  const reduced = useReducedMotion();
  return <div className="sg-research-artifact sg-post-frames"><AnimatePresence initial={false} mode="wait"><motion.div key={moment} className={`sg-research-frame sg-research-frame-${moment}`} initial={{ y: reduced ? 0 : 20, opacity: reduced ? 1 : 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduced ? 0 : -14, opacity: 0 }} transition={{ duration: reduced ? 0 : .28, ease }}>
    {moment === 0 ? <><div className="sg-interview-top"><span>CueVu / Interview guide</span><span>01</span></div><div className="sg-interview-question"><span>The switching moment</span><strong>What were you feeling<br />when it happened?</strong></div><div className="sg-response-line"><span aria-hidden="true">↳</span> Leave room for their own words.</div></> : moment === 1 ? <><div className="sg-sheet-toolbar"><span className="sg-sheet-icon" aria-hidden="true">▤</span><span>Proposed results template</span><span>CueVu</span></div><div className="sg-sheet-columns"><span /> <span>A</span><span>B</span></div><div className="sg-sheet-row"><span>1</span><b>Original response</b><b>Research notes</b></div><div className="sg-sheet-row sg-sheet-response"><span>2</span><div><i>Customer’s exact words</i><span className="sg-empty-lines" aria-hidden="true" /></div><div><i>Situation around the switch</i><span className="sg-empty-lines" aria-hidden="true" /></div></div><div className="sg-sheet-bottom"><span>＋</span><b>Responses</b><span>Proposed review sheet</span></div></> : <><div className="sg-planner-browser"><span aria-hidden="true">↗</span> CueVu / Research planner</div><div className="sg-planner-preview"><span>YOUR NEXT STUDY</span><strong>Start with the<br />research question.</strong><div><span>Product category</span><b>Choose your category <span aria-hidden="true">⌄</span></b></div><span className="sg-planner-preview-cta">Build your brief <span aria-hidden="true">↗</span></span></div></>}
  </motion.div></AnimatePresence></div>;
}

export function LinkedInActions() {
  return <div className="sg-linkedin-actions" aria-hidden="true"><span><svg viewBox="0 0 24 24"><path d="M8 10l4-7c2 0 3 1 2 4l-1 3h6c2 0 2 1 2 3l-2 7H8M3 10h5v10H3z" /></svg>Like</span><span><svg viewBox="0 0 24 24"><path d="M21 11a9 8 0 0 1-9 8H5l-3 3V11a9 8 0 0 1 19 0z" /></svg>Comment</span><span><svg viewBox="0 0 24 24"><path d="M4 8h15l-4-4M20 16H5l4 4M19 8v5M5 16v-5" /></svg>Repost</span><span><svg viewBox="0 0 24 24"><path d="M3 3l18 8-8 2-2 8zM3 3l10 10" /></svg>Send</span></div>;
}

export function LinkedInBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const leftY = useTransform(scrollYProgress, [0, 1], [0, -130]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  return <div className="sg-linkedin-backdrop" ref={ref} aria-hidden="true">
    <motion.div className="sg-feed-fragment sg-feed-fragment-left" style={reduced ? undefined : { y: leftY, rotate: -8 }}><div className="sg-feed-brand">in <span>Your feed</span></div><div className="sg-feed-author"><img src={founder.avatar} alt="" /><span>Andrew Hayes<small>Customer research at CueVu</small></span></div><p>What makes someone<br />change brands?</p><div className="sg-feed-document"><span>CueVu</span><b>Inside the<br />switching moment.</b></div><LinkedInActions /></motion.div>
    <motion.div className="sg-feed-fragment sg-feed-fragment-right" style={reduced ? undefined : { y: rightY, rotate: 8 }}><div className="sg-feed-brand">in <span>Messaging</span></div><div className="sg-feed-author"><img src={founder.avatar} alt="" /><span>Andrew Hayes<small>CueVu</small></span></div><div className="sg-feed-message">Which brands are you comparing?</div><div className="sg-feed-composer">Write a message…<span>↗</span></div></motion.div>
  </div>;
}

/** Two founders the engine already runs for. Kyle's figure is his verified monthly agency revenue; RISE is shown as published work with no revenue claim. */
export function ClientProof() {
  const [riseImageFailed, setRiseImageFailed] = useState(false);
  const [kyleImageFailed, setKyleImageFailed] = useState(false);
  return <section className="sg-proof" id="proof">
    <div className="sg-proof-heading"><p>Already running for other founders</p><h2 className="sg-display">Same engine.<br />Other feeds.</h2></div>
    <div className="proof-grid">
      <motion.article className="proof-card proof-kyle" initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .7, ease }}>
        <div className="proof-person"><img src="/content-system/kyle-portrait.webp" alt="Kyle Hunt" loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span><b>Kyle Hunt</b><small>Agency Operators, founder</small></span></div>
        <div className="proof-figure"><span className="proof-figk">Agency MRR</span><span className="proof-fig"><span className="from">$30K/mo →</span> $80K/mo</span></div>
        <blockquote className="proof-quote">“Leads come in with a name and the guide they pulled. By the time we talk, they already know the offer.”</blockquote>
        <figure className="proof-sample">{kyleImageFailed ? <span className="tool-image-fallback">Kyle’s guide library</span> : <img src="/content-system/kyle-guides.webp" alt="Kyle Hunt’s guide library, generated and shipped by the engine" loading="lazy" onError={() => setKyleImageFailed(true)} />}<figcaption>Kyle’s lead magnets, written and published by the engine.</figcaption></figure>
      </motion.article>
      <motion.article className="proof-card proof-rise" initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .7, delay: .12, ease }}>
        <div className="proof-person"><span className="demo-avatar" aria-hidden="true">MD</span><span><b>Mattan Danino</b><small>RISE DTC, founder</small></span></div>
        <div className="sg-real-browser proof-browser" data-mockup="browser"><div className="sg-browser-bar"><span className="sg-browser-dots" aria-hidden="true"><i /><i /><i /></span><span>resources.risedtc.com/tools</span><a href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer" aria-label="Open the RISE DTC tools library in a new tab">↗</a></div><div className="sg-real-browser-viewport">{riseImageFailed ? <a className="tool-image-fallback" href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer">Preview image unavailable. Open the library ↗</a> : <a href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer" aria-label="Open the RISE DTC tools library"><img src="/scan-preview/rise-tools.jpg" alt="The published RISE DTC tools library" loading="lazy" onError={() => setRiseImageFailed(true)} /></a>}</div></div>
        <p className="proof-text">A published library his buyers come back to: calculators, audits and a DTC skills kit. Daily posts, the resources and the follow-up all run from the same engine.</p>
        <a className="sg-tool-try" href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer">Open the library <span aria-hidden="true">↗</span></a>
      </motion.article>
    </div>
    <p className="sg-tool-bridge">Kyle’s figure is his agency’s monthly revenue before and after. The RISE pages are shown as published work, with no revenue claim. <a href="#inbound">Back to your score ↑</a></p>
  </section>;
}

/** Original, opt-in ambient score. No context is created until a user clicks. */
export function StorySound() {
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const context = audio.current;
    audio.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    setEnabled(false);
  };
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); stop(); };
  }, []);
  const toggle = async () => {
    if (audio.current) { stop(); return; }
    if (!window.AudioContext) { setUnavailable(true); return; }
    try {
      const context = new AudioContext();
      audio.current = context;
      await context.resume();
      if (audio.current !== context) return;
      let beat = 0;
      const notes = [130.81, 196, 261.63, 329.63, 146.83, 220, 293.66, 349.23];
      const play = () => {
        if (context.state !== 'running') return;
        const now = context.currentTime;
        for (const [offset, level] of [[0, .028], [12, .008]]) {
          const voice = context.createOscillator();
          const gain = context.createGain();
          voice.type = 'sine'; voice.frequency.value = notes[beat % notes.length] * 2 ** (offset / 12);
          gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + .12); gain.gain.exponentialRampToValueAtTime(.0001, now + 3);
          voice.connect(gain); gain.connect(context.destination); voice.start(now); voice.stop(now + 3.1);
          voice.onended = () => { voice.disconnect(); gain.disconnect(); };
        }
        beat++;
      };
      play(); timer.current = setInterval(play, 1150); setEnabled(true);
    } catch { stop(); setUnavailable(true); }
  };
  return <button className="sg-sound-toggle" aria-label={unavailable ? 'Sound unavailable in this browser' : 'Ambient soundtrack'} aria-pressed={enabled} disabled={unavailable} onClick={() => void toggle()}><span className={`sg-sound-bars${enabled ? ' is-playing' : ''}`} aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} style={{ animationDelay: `${i * -.19}s` }} />)}</span><span>{unavailable ? 'Sound unavailable' : enabled ? 'Sound on' : 'Sound off'}</span></button>;
}
