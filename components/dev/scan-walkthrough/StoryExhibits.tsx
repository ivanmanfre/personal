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

const clientTools = [
  { id: 'roas', label: 'ROAS calculator', title: 'The number behind an ad budget.', description: 'Change the inputs. See what it takes to break even.', url: 'https://resources.risedtc.com/tools/break-even-roas/', image: '/scan-preview/rise-roas.jpg', alt: 'RISE DTC’s live break-even ROAS calculator, showing inputs and a calculated result' },
  { id: 'tools', label: 'DTC tools library', title: 'A whole reason to come back.', description: 'Mattan’s library of calculators and Claude tools.', url: 'https://resources.risedtc.com/tools/', image: '/scan-preview/rise-tools.jpg', alt: 'The published RISE DTC tools library' },
  { id: 'profit', label: 'Profit X-ray', title: 'A resource built around their numbers.', description: 'The entry page for RISE DTC’s profit-per-order X-ray.', url: 'https://resources.risedtc.com/rise-dtc-true-profit-x-ray/', image: '/scan-preview/rise-profit.jpg', alt: 'RISE DTC’s published profit-per-order X-ray landing page' },
];

export function ClientToolsShowcase() {
  const [selected, setSelected] = useState(0);
  const [live, setLive] = useState(false);
  const reduced = useReducedMotion();
  const tool = clientTools[selected];
  const choose = (index: number) => { setLive(false); setSelected(index); };
  return <section className="sg-client-tools" id="client-tools" data-story-scene>
    <div className="sg-client-tools-heading"><p>Built for Mattan Danino / RISE DTC</p><h2 className="sg-display"><span className="sg-line"><span>Give them something</span></span><span className="sg-line"><span>they’ll actually use.</span></span></h2></div>
    <div className="sg-tool-tabs" role="group" aria-label="Mattan’s lead magnet examples">{clientTools.map((item, index) => <button key={item.id} aria-pressed={selected === index} onClick={() => choose(index)}>{item.label}{selected === index && <motion.span layoutId="client-tool-selection" transition={{ duration: reduced ? 0 : .4, ease }} />}</button>)}</div>
    <motion.div className="sg-real-browser" data-mockup="browser" initial={reduced ? false : { opacity: 0, y: 50, rotateX: 5 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: reduced ? 0 : .85, ease }}>
      <div className="sg-browser-bar"><span className="sg-browser-dots" aria-hidden="true"><i /><i /><i /></span><span>resources.risedtc.com</span><a href={tool.url} target="_blank" rel="noreferrer" aria-label={`Open ${tool.label} in a new tab`}>↗</a></div>
      <div className={`sg-real-browser-viewport${live ? ' is-live' : ''}`}>
        {live ? <iframe src={`${tool.url}#calculator`} title={`Live RISE DTC ${tool.label}`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" /> : <AnimatePresence mode="wait" initial={false}><motion.a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .3, ease }} aria-label={`Open published ${tool.label}`}><picture><source media="(max-width: 767px)" srcSet={tool.image.replace(".jpg", "-mobile.jpg")} /><img src={tool.image} alt={tool.alt} width="1280" height="840" loading="lazy" /></picture></motion.a></AnimatePresence>}
      </div>
    </motion.div>
    <div className="sg-tool-caption"><div><h3>{tool.title}</h3><p>{tool.description}</p></div>{selected === 0 ? <button className="sg-tool-try" onClick={() => setLive(value => !value)}>{live ? 'Back to preview' : 'Try the live calculator'}<span aria-hidden="true">{live ? '↑' : '↗'}</span></button> : <a className="sg-tool-try" href={tool.url} target="_blank" rel="noreferrer">Open the real page <span aria-hidden="true">↗</span></a>}</div>
    <p className="sg-tool-bridge">For CueVu, that could be a research planner. <a href="#inbound">Try yours below ↓</a></p>
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
