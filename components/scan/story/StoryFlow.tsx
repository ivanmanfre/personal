import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useInView, useReducedMotion} from 'framer-motion';
import {CalendarDays, Check, FileText, Eye, Radar, Pause, Play} from 'lucide-react';
import {useStory} from './context';
import {Beams} from './motion';
import type {StoryEdition} from './types';

/** The example reader's first name, taken from the edition's own conversation so every sample agrees. */
export function readerName(plan: StoryEdition): string {
 const founderFirst = plan.founderName.split(' ')[0];
 for (const m of plan.flow.messages) { const who = m.match(/^([^:]{1,40}):/)?.[1]?.trim(); if (who && !who.startsWith(founderFirst)) return who.split(' ')[0]; }
 const hi = plan.message.match(/^(?:Hi|Hey|Hello|Ciao|Hola)\s+([A-Z][\p{L}'-]+)/u)?.[1];
 return hi && hi !== founderFirst ? hi : founderFirst === 'Alex' ? 'Sam' : 'Alex';
}
/** Generated copy sometimes keeps a mail-merge slot; fill it with the example reader. */
export const fillName = (text: string, name: string) => text.replace(/\{\s*first[\s_]?name\s*\}/gi, name).replace(/^(Hi|Hey|Hello),\s/, `$1 ${name}, `);

const SOURCES = [
 {id: 'content', title: 'Content & lead magnets', hint: 'They comment for your resource.', Icon: FileText},
 {id: 'warm', title: 'Warm outreach', hint: 'They visited your profile or engaged.', Icon: Eye},
 {id: 'signal', title: 'Signal-based outreach', hint: 'A live project at a company that fits.', Icon: Radar},
];
const STEP_MS = 2600, LAST = 4;

export function StoryFlow({founder}: {founder: string}) {
 const plan = useStory(), reader = readerName(plan), reduced = useReducedMotion();
 const root = useRef<HTMLDivElement>(null), seen = useInView(root, {amount: .25});
 const [source, setSource] = useState(0), [step, setStep] = useState(reduced ? LAST : 1), [paused, setPaused] = useState(false);
 const running = seen && !paused && !reduced;
 useEffect(() => {
  if (!running) return;
  const t = window.setTimeout(() => {
   if (step < LAST) setStep(step + 1);
   else { setStep(1); setSource(s => (s + 1) % SOURCES.length); }
  }, step === LAST ? STEP_MS * 1.8 : STEP_MS);
  return () => clearTimeout(t);
 }, [running, step]);
 const messages = plan.flow.messages.map(m => { const [, who, text] = m.match(/^([^:]{1,40}):\s*(.*)$/s) ?? [null, '', m]; return {mine: !!who && !who.startsWith(reader), text: fillName(text, reader)}; });
 const shown = messages.slice(0, Math.min(step + 1, messages.length));
 const beams = [
  ...SOURCES.map((s, i) => ({from: s.id, to: 'chat', active: i === source})),
  {from: 'chat', to: 'qualify', active: step >= 1},
  {from: 'qualify', to: 'booked', active: step >= LAST, vertical: true},
 ];
 return <div className="sf" ref={root}>
  <div className="sf-board">
   <Beams root={root} beams={beams} deps={[source, step]}/>
   <ol className="sf-sources" aria-label="Where the conversation starts">
    {SOURCES.map(({id, title, hint, Icon}, i) => <li key={id}><button data-beam={id} className={i === source ? 'is-on' : ''} aria-pressed={i === source} onClick={() => { setSource(i); setStep(1); }}>
     <span className="sf-icon"><Icon size={18}/></span><span><b>{title}</b><small>{hint}</small></span></button></li>)}
   </ol>
   <div className="sf-chat" data-beam="chat">
    <header><span className="sf-avatar">{reader[0]}</span><span><b>{reader}</b><small>{plan.buyerRole}</small></span><em>{SOURCES[source].title}</em></header>
    <div className="sf-thread" aria-live="polite">
     <AnimatePresence initial={false}>{shown.map((m, i) => <motion.p key={`${source}-${i}`} className={m.mine ? 'is-mine' : ''}
      initial={reduced ? false : {opacity: 0, y: 14, scale: .98}} animate={{opacity: 1, y: 0, scale: 1}} transition={{type: 'spring', stiffness: 260, damping: 26}}>{m.text}</motion.p>)}</AnimatePresence>
     {running && step < messages.length - 1 && <span className="sf-typing" aria-hidden="true"><i/><i/><i/></span>}
    </div>
   </div>
   <div className="sf-outcome">
    <div className="sf-qualify" data-beam="qualify">
     <b>We check the fit</b>
     {plan.flow.checks.map((c, i) => { const on = step >= i + 1; return <div key={c.label} className={on ? 'is-on' : ''}>
      <span className="sf-tick">{on && <motion.span initial={reduced ? false : {scale: 0}} animate={{scale: 1}} transition={{type: 'spring', stiffness: 500, damping: 22}}><Check size={13} strokeWidth={3}/></motion.span>}</span>
      <span><b>{c.label}</b><AnimatePresence>{on && <motion.small initial={reduced ? false : {opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}}>{fillName(c.value, reader)}</motion.small>}</AnimatePresence></span>
     </div>; })}
    </div>
    <motion.div className={`sf-booked ${step >= LAST ? 'is-on' : ''}`} data-beam="booked" animate={step >= LAST && !reduced ? {scale: [1, 1.03, 1]} : {}} transition={{duration: .5}}>
     <CalendarDays size={22}/>
     <span><small>{step >= LAST ? 'Booked in your calendar' : 'Booked once it fits'}</small><b>{plan.flow.callTitle}</b><em>{reader} + {founder} · brief attached</em></span>
    </motion.div>
   </div>
  </div>
  <footer className="sf-foot">
   <div className="sf-progress" aria-hidden="true"><motion.i animate={{width: `${(step / LAST) * 100}%`}} transition={{duration: reduced ? 0 : .6, ease: [.22, .84, .36, 1]}}/></div>
   {!reduced && <button onClick={() => setPaused(v => !v)} aria-label={paused ? 'Play the example' : 'Pause the example'}>{paused ? <Play size={14}/> : <Pause size={14}/>}{paused ? 'Play' : 'Pause'}</button>}
  </footer>
 </div>;
}
