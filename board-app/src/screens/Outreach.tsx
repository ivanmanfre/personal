import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { Model, Person, Step } from '../data/model';
import { ago, fmtDay } from '../data/model';
import { intentLabel, intentTone } from '../data/copy';
import { fmtInt } from '../data/derive';
import { AnimatedNumber, Avatar, SectionHead, SOFT, SPRING, useIsPhone } from '../ui/kit';
import { useNav } from '../ui/nav';
import { track } from '../data/track';
import { Results } from './Home';

/* funnel-chart move: hovering a stage dims the others; the table columns below drive the same highlight. */
export function Funnel({ steps, hover, setHover, size = 'md' }: { steps: Step[]; hover: number | null; setHover: (i: number | null) => void; size?: 'md' | 'lg' }) {
  const reduce = useReducedMotion();
  const max = Math.max(steps[0]?.value || 0, 1);
  return (
    <div className="flex flex-col gap-2.5" onMouseLeave={() => setHover(null)}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : 0;
        const pct = i > 0 && prev && s.value <= prev ? Math.round((s.value / prev) * 100) : null;
        const dim = hover != null && hover !== i;
        const w = s.value ? Math.max((s.value / max) * 100, 1.2) : 0;
        return (
          <div
            key={s.label}
            onMouseEnter={() => setHover(i)}
            className="grid items-center gap-3 sm:gap-4"
            style={{ gridTemplateColumns: 'minmax(0, 132px) minmax(0, 1fr) 76px', opacity: dim ? 0.38 : 1, transition: 'opacity .2s ease' }}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] text-soft truncate">{s.label}</div>
              <div className="text-[11.5px] text-mute tnum h-4 truncate">{pct != null ? `${pct}% of ${steps[i - 1].label.toLowerCase()}` : ''}</div>
            </div>
            <div className={`relative ${size === 'lg' ? 'h-10' : 'h-8'} rounded-[8px] bg-sunk overflow-hidden`}>
              <motion.div
                className="bar-x absolute inset-y-0 left-0 rounded-[8px]"
                style={{ width: `${w}%`, background: hover === i ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 78%, var(--paper))' }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ ...SOFT, delay: i * 0.06 }}
              />
            </div>
            <div className="text-right"><AnimatedNumber value={s.value} className={`numeral ${size === 'lg' ? 'text-[28px]' : 'text-[22px]'}`} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function Weekly({ weeks }: { weeks: Model['weekly'] }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...weeks.map(w => w.replied), 1);
  const H = 120;
  if (!weeks.length) return null;
  return (
    <div>
      <div className="grid items-end gap-1.5 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} onMouseLeave={() => setHover(null)}>
        {weeks.map((w, i) => {
          const h = Math.max((w.replied / max) * H, w.replied ? 3 : 1);
          const on = hover === i;
          return (
            <div key={w.week} className="flex flex-col items-center min-w-0" onMouseEnter={() => setHover(i)}>
              <div className="flex flex-col items-center justify-end w-full" style={{ height: H + 44 }}>
                <div className="flex flex-col-reverse items-center gap-[3px] mb-1.5" aria-label={w.booked ? `${w.booked} booked` : undefined}>
                  {Array.from({ length: w.booked }, (_, d) => (
                    <motion.span key={d} className="block h-[7px] w-[7px] rounded-full bg-accent" initial={reduce ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING, delay: 0.35 + i * 0.03 }} />
                  ))}
                </div>
                <span className={`text-[12px] tnum mb-1 ${on ? 'text-ink font-semibold' : 'text-mute'}`}>{w.replied}</span>
                <motion.div
                  className="bar-y w-full rounded-t-[5px]"
                  style={{ height: h, maxWidth: 36, background: on ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 72%, var(--paper))' }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...SOFT, delay: i * 0.035 }}
                />
              </div>
              <span className={`mt-2 text-[11px] tnum whitespace-nowrap ${on ? 'text-ink' : 'text-mute'} ${i % 2 ? 'max-sm:invisible' : ''}`}>{fmtDay(w.week)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-5 text-[12px] text-mute">
        <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--accent) 72%, var(--paper))' }} />People who replied</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-[7px] w-[7px] rounded-full bg-accent" />Call booked</span>
      </div>
    </div>
  );
}

export function Lanes({ m, hover, setHover }: { m: Model; hover: number | null; setHover: (i: number | null) => void }) {
  const phone = useIsPhone();
  const [row, setRow] = useState<number | null>(null);
  const contactedOnly = m.lanes.some(l => l.replied < 0);
  const cols = contactedOnly
    ? [{ k: 'reached' as const, label: 'Contacted', step: 0 }]
    : [
        { k: 'reached' as const, label: 'Reached', step: 0 },
        ...(phone ? [] : [{ k: 'accepted' as const, label: 'Connected', step: 1 }]),
        { k: 'replied' as const, label: 'Replied', step: 2 },
        { k: 'booked' as const, label: 'Booked', step: 3 },
      ];
  const max = Math.max(...m.lanes.map(l => l.reached), 1);
  const tpl = `minmax(0, 1fr) repeat(${cols.length}, ${phone ? '62px' : '92px'})`;
  if (!m.lanes.length) return null;
  return (
    <div onMouseLeave={() => { setHover(null); setRow(null); }}>
      <div className="grid items-end gap-2 pb-2.5 border-b hair" style={{ gridTemplateColumns: tpl }}>
        <span className="eyebrow">Where people came from</span>
        {cols.map(c => (
          <span key={c.k} onMouseEnter={() => setHover(c.step)}
            className={`eyebrow text-right !tracking-[0.06em] cursor-default ${hover === c.step ? '!text-accent-fg' : ''}`}>{c.label}</span>
        ))}
      </div>
      {m.lanes.map((l, i) => (
        <div key={l.name} className="relative grid items-center gap-2 py-3 border-b hair" style={{ gridTemplateColumns: tpl }} onMouseEnter={() => setRow(i)}>
          {row === i && <motion.span layoutId="lane-pill" className="absolute -inset-x-2 inset-y-1 rounded-[10px] bg-sunk" transition={SPRING} />}
          <div className="relative min-w-0">
            <div className="text-[14px] text-ink leading-snug max-sm:line-clamp-2 sm:truncate">{l.name}</div>
            <div className="mt-1.5 h-[3px] rounded-full bg-line overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(l.reached / max) * 100}%`, opacity: 0.7 }} />
            </div>
          </div>
          {cols.map(c => (
            <span key={c.k} onMouseEnter={() => setHover(c.step)}
              className={`relative text-right tnum text-[14px] ${hover === c.step ? 'text-ink font-semibold' : c.k === 'booked' && l.booked ? 'text-accent-fg font-semibold' : 'text-soft'}`}>
              {fmtInt(l[c.k])}
            </span>
          ))}
        </div>
      ))}
      <div className="mt-2.5 text-[12px] text-mute">{m.lanesNote}</div>
    </div>
  );
}

export function OutreachPanel({ full = false }: { full?: boolean }) {
  const { model: m, go } = useNav();
  const [hover, setHover] = useState<number | null>(null);
  if (!m.hasOutreach) return <p className="text-[14px] text-mute">No outreach numbers yet.</p>;
  // Every number counts the board's period. All-time totals and the all-time source table stay off
  // the board: they mix months and read as this period's work.
  const f = m.funnel;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-10 ${full ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12' : ''}`}>
        {f && (
          <div>
            <SectionHead eyebrow={<>Invite to call · {f.label}</>} />
            <Funnel steps={f.steps} hover={hover} setHover={setHover} size={full ? 'lg' : 'md'} />
          </div>
        )}
        {m.weekly.length > 0 && (
          <div>
            <SectionHead eyebrow={<>Replies each week · last {m.weekly.length} weeks</>} />
            <Weekly weeks={m.weekly} />
          </div>
        )}
      </div>
      {!full && (
        <button className="link self-start justify-self-start" onClick={() => go('outreach')}>Full outreach page <ArrowRight size={15} /></button>
      )}
    </div>
  );
}

export function PeopleList({ people, limit, showAll }: { people: Person[]; limit?: number; showAll?: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const list = limit && !all ? people.slice(0, limit) : people;
  if (!people.length) return <p className="text-[15px] text-mute">Nobody here yet.</p>;
  return (
    <div>
      <ul onMouseLeave={() => setHover(null)}>
        {list.map((p, i) => (
          <li key={p.name + p.when} className="relative flex items-center gap-3.5 py-2.5 border-b hair" onMouseEnter={() => setHover(i)}>
            {hover === i && <motion.span layoutId="people-pill" className="absolute -inset-x-2.5 inset-y-1 rounded-[12px] bg-sunk" transition={SPRING} />}
            <span className="relative"><Avatar name={p.name} size={32} tone={p.kind === 'booked' ? 'accent' : 'wash'} /></span>
            <div className="relative min-w-0 flex-1">
              <div className="text-[14.5px] text-ink truncate">{p.name}</div>
              {p.company && <div className="text-[13px] text-mute truncate">{p.company}</div>}
            </div>
            <span className={`relative chip max-sm:hidden ${intentTone(p.intent) === 'accent' ? 'chip-accent' : intentTone(p.intent) === 'mute' ? 'chip-mute' : ''}`}>{intentLabel(p.intent)}</span>
            <span className="relative w-[84px] text-right text-[12.5px] text-mute tnum shrink-0">
              <span className="sm:hidden block text-[11.5px] font-semibold" style={{ color: intentTone(p.intent) === 'accent' ? 'var(--accent-fg)' : 'var(--soft)' }}>{intentLabel(p.intent)}</span>
              {ago(p.when)}
            </span>
          </li>
        ))}
      </ul>
      {limit && people.length > limit && (
        <button className="btn btn-outline btn-sm mt-5" onClick={() => { if (!all) track('expand', null, { which: 'people_all' }); if (showAll) showAll(); else setAll(a => !a); }}>
          {all ? 'Show fewer' : `Show all ${people.length}`}
        </button>
      )}
    </div>
  );
}

export function OutreachPage() {
  const { model: m } = useNav();
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 pt-6 sm:pt-8 pb-20">
      <div className="eyebrow mb-2">{m.hasOutreach ? m.window.label : 'Outreach'}</div>
      <h1 className="display text-[28px] sm:text-[32px] mb-6">Outreach</h1>
      {!m.hasOutreach ? (
        <div className="max-w-[620px]">
          <p className="text-[15px] text-soft">No outreach numbers yet.</p>
          <p className="mt-1.5 text-[14px] text-mute">You will see who booked a call, who replied and where each person came from, counted from the real conversations.</p>
        </div>
      ) : (
        <>
          <Results />
          <div className="mt-10"><OutreachPanel full /></div>
          <div className="mt-10">
            <SectionHead eyebrow={<>Who booked or replied · newest first</>} />
            <PeopleList people={m.people} />
          </div>
        </>
      )}
    </div>
  );
}
