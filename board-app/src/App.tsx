import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ChartNoAxesColumnIncreasing, Columns3, ExternalLink, History, House, LogOut, Send, UserRound } from 'lucide-react';
import { AuthError, loadBoard, redeem, type Cred, type Raw } from './data/api';
import { buildModel, type Model } from './data/model';
import { themeFor, cssVars, loadFonts } from './data/theme';
import { LocalProvider, useLocal, useLocalMaybe } from './data/store';
import { AuthCtx, useAuth, type Auth } from './data/auth';
import { DEV_BOARDS, classicUrl, readEntry, type Entry } from './data/entry';
import { clearBoardSession, loadBoardSession, readMagicLinkFragment, saveBoardSession, stripMagicLinkFragment, type BoardSession } from './data/session';
import { flushNow, setTrackCred, setView as setTrackView, startTracking, track, trackPageview, trackVisit } from './data/track';
import { NavCtx, type Nav, type PeopleKind, type View } from './ui/nav';
import { SPRING, Toaster, useIsPhone } from './ui/kit';
import { PeopleSheet, PostSheet } from './ui/sheets';
import { SignInForm, SignInScreen } from './ui/SignIn';
import { Home } from './screens/Home';
import { Focus } from './screens/Focus';
import { Pipeline } from './screens/Pipeline';
import { OutreachPage } from './screens/Outreach';
import { ActivityPage } from './screens/Activity';
import { ContentPage } from './screens/Content';

const VIEWS: { id: View; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'posts', label: 'Posts', Icon: Columns3 },
  { id: 'content', label: 'Content', Icon: ChartNoAxesColumnIncreasing },
  { id: 'outreach', label: 'Outreach', Icon: Send },
  { id: 'activity', label: 'Activity', Icon: History },
];
const SHORT: Record<string, string> = { 'arch-agency': 'ARCH', 'risedtc-com': 'RISE', 'swishdm-live': 'SwishDM' };
const REFRESH_MS = 5 * 60 * 1000;

const readView = (): View => {
  const v = new URLSearchParams(location.search).get('view') as View;
  return VIEWS.some(x => x.id === v) ? v : 'home';
};

function applyTheme(slug: string, board?: any) {
  const t = themeFor(slug, board);
  for (const [k, v] of Object.entries(cssVars(t))) document.documentElement.style.setProperty(k, v);
  document.documentElement.style.colorScheme = t.dark ? 'dark' : 'light';
  loadFonts(t);
  document.title = `${t.name} · content board`;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'signin'; note?: string }
  | { kind: 'ready' }
  | { kind: 'error'; text: string };

export default function App() {
  const [entry] = useState<Entry>(readEntry);
  const [view, setView] = useState<View>(readView);
  const [cred, setCred] = useState<Cred>(() => ({ slug: entry.slug, token: entry.token, session: loadBoardSession(entry.slug) }));
  const credRef = useRef(cred);
  credRef.current = cred;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [model, setModel] = useState<Model | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const busy = useRef(false);

  useEffect(() => { applyTheme(entry.slug, model ? { company_name: model.company, review_mode: model.reviewMode } : undefined); }, [entry.slug, model?.company]); // eslint-disable-line
  useEffect(() => { setTrackCred(cred); }, [cred]);
  useEffect(() => { setTrackView(view); }, [view]);

  /** Read the board with a credential. Throws AuthError when the link or session no longer opens it. */
  const read = useCallback(async (c: Cred) => {
    const started = Date.now();
    const raw: Raw = await loadBoard(c);
    // A stored session the server no longer knows (revoked or expired): drop it, keep the board link.
    if (c.session && !raw.me) {
      clearBoardSession(c.slug);
      const next = { ...c, session: null };
      setCred(next);
      credRef.current = next;
    }
    setModel(buildModel(c.slug, raw));
    setFetchedAt(started);
    return raw;
  }, []);

  // First load, in the live board's order: ?k= link, then a #ml= sign-in link, then a stored session, else sign in.
  useEffect(() => {
    let dead = false;
    (async () => {
      const slug = entry.slug;
      if (!slug) { setPhase({ kind: 'error', text: 'This address does not point at a board.' }); return; }
      let note: string | undefined;
      const c0 = credRef.current;
      if (c0.token) {
        try { await read(c0); if (!dead) ready(c0.session ? 'session' : 'link'); return; }
        catch (e) {
          if (!(e instanceof AuthError)) { if (!dead) setPhase({ kind: 'error', text: String((e as Error).message || e) }); return; }
          note = 'This board link no longer opens the board. Sign in with your email instead.';
          const next = { ...credRef.current, token: '' };
          setCred(next); credRef.current = next;
        }
      }
      const ml = readMagicLinkFragment();
      if (ml) {
        const s = await redeem(slug, ml, 'link');
        stripMagicLinkFragment();
        if (dead) return;
        if (s) {
          saveBoardSession(slug, s);
          const next = { ...credRef.current, session: s };
          setCred(next); credRef.current = next;
          try { await read(next); track('sign_in', null, { how: 'link' }); if (!dead) ready('session'); return; } catch { /* fall through */ }
        } else {
          note = 'That sign-in link has run out or was already used. Ask for a new code below.';
        }
      }
      const stored = credRef.current.session || loadBoardSession(slug);
      if (stored?.token) {
        const next = { ...credRef.current, session: stored };
        try { await read(next); if (!dead) ready('session'); return; }
        catch { clearBoardSession(slug); const n2 = { ...credRef.current, session: null }; setCred(n2); credRef.current = n2; }
      }
      if (!dead) setPhase({ kind: 'signin', note });
    })();
    return () => { dead = true; };
    function ready(how: 'link' | 'session') {
      setPhase({ kind: 'ready' });
      startTracking(credRef.current);
      trackVisit(readView(), how);
      track('view');
      trackPageview(entry.slug);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fresh numbers and posts: when the tab comes back into view, and every 5 minutes while it is open.
  const refetch = useCallback(async () => {
    if (busy.current || document.visibilityState !== 'visible') return;
    busy.current = true;
    try { await read(credRef.current); } catch { /* keep what is on screen */ } finally { busy.current = false; }
  }, [read]);
  useEffect(() => {
    if (phase.kind !== 'ready') return;
    const onVis = () => { if (document.visibilityState === 'visible') void refetch(); };
    window.addEventListener('focus', onVis);
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(() => void refetch(), REFRESH_MS);
    return () => { window.removeEventListener('focus', onVis); document.removeEventListener('visibilitychange', onVis); window.clearInterval(iv); };
  }, [phase.kind, refetch]);

  useEffect(() => {
    const on = () => setView(readView());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  const go = useCallback((v: View) => {
    const q = new URLSearchParams(location.search);
    if (import.meta.env.DEV) q.set('board', entry.slug);
    q.set('view', v);
    history.pushState(null, '', `${location.pathname}?${q}`);
    setView(v);
    setTrackView(v);
    track('view');
    window.scrollTo({ top: 0 });
  }, [entry.slug]);

  const auth = useMemo<Auth>(() => ({
    entry, cred,
    signedIn: (s: BoardSession) => {
      saveBoardSession(entry.slug, s);
      const next = { ...credRef.current, session: s };
      setCred(next); credRef.current = next;
      if (phase.kind === 'signin') {
        read(next).then(() => {
          setPhase({ kind: 'ready' });
          startTracking(next);
          trackVisit(readView(), 'session');
          track('view');
          trackPageview(entry.slug);
        }).catch(() => setPhase({ kind: 'signin', note: 'Signed in, but the board did not open. Try once more.' }));
      } else {
        void read(next).catch(() => null);
      }
    },
    signOut: () => {
      clearBoardSession(entry.slug);
      const next = { ...credRef.current, session: null };
      setCred(next); credRef.current = next;
      if (!next.token) { setModel(null); setPhase({ kind: 'signin' }); }
      else void read(next).catch(() => null);
    },
  }), [entry, cred, phase.kind, read]);

  const t = themeFor(entry.slug);
  return (
    <MotionConfig reducedMotion="user">
      <AuthCtx.Provider value={auth}>
        {phase.kind === 'ready' && model ? (
          <LocalProvider model={model} fetchedAt={fetchedAt} cred={cred}>
            <Shell view={view} go={go} />
          </LocalProvider>
        ) : phase.kind === 'signin' ? (
          <SignInScreen slug={entry.slug} name={t.name} note={phase.note} onAuthed={auth.signedIn} />
        ) : (
          <div className="app">
            <Chrome view={view} go={go} wordmark={t.name} />
            <main className="md:pl-[var(--rail)]">
              <div className="mx-auto max-w-[1040px] px-5 sm:px-8 pt-16">
                {phase.kind === 'error' ? (
                  <div className="max-w-[560px]">
                    <div className="eyebrow mb-4">Could not load the board</div>
                    <p className="display text-[30px]">The board did not answer.</p>
                    <p className="mt-3 text-mute text-[14px]">Check your connection, then try again.</p>
                    <button className="btn btn-primary mt-6" onClick={() => location.reload()}>Try again</button>
                  </div>
                ) : (
                  <div aria-busy className="grid grid-cols-[minmax(0,1fr)] gap-5">
                    <div className="eyebrow">Loading your board</div>
                    {[68, 44, 30].map((w, i) => (
                      <motion.div key={i} className="h-10 rounded-[10px] bg-sunk" style={{ width: `${w}%` }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </AuthCtx.Provider>
    </MotionConfig>
  );
}

function Shell({ view, go }: { view: View; go: (v: View) => void }) {
  const { model } = useLocal();
  const [focus, setFocus] = useState<{ open: boolean; start?: string }>({ open: false });
  const [post, setPost] = useState<{ id: string | null; edit?: boolean }>({ id: null });
  const [people, setPeople] = useState<PeopleKind | null>(null);

  const nav = useMemo<Nav>(() => ({
    model, view, go,
    openFocus: id => { setPost({ id: null }); setFocus({ open: true, start: id }); track('open_focus', id || null); },
    openPost: (id, edit) => { setPost({ id, edit }); track('open_post', id, edit ? { edit: true } : null); },
    openPeople: k => { setPeople(k); track('expand', null, { which: `people:${k}` }); },
  }), [model, view, go]);

  const Screen = { home: Home, posts: Pipeline, content: ContentPage, outreach: OutreachPage, activity: ActivityPage }[view];

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        <Chrome view={view} go={go} wordmark={model.wordmark} logo={model.logo} live />
        <main className="md:pl-[var(--rail)] pb-[72px] md:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.25 }}>
              <Screen />
            </motion.div>
          </AnimatePresence>
        </main>
        <AnimatePresence>
          {focus.open && <Focus key="focus" m={model} startId={focus.start} onClose={() => setFocus({ open: false })} />}
        </AnimatePresence>
        <PostSheet m={model} postId={post.id} edit={post.edit} onClose={() => setPost({ id: null })} onReview={id => nav.openFocus(id)} />
        <PeopleSheet m={model} kind={people} onClose={() => setPeople(null)} />
        <Toaster />
      </div>
    </NavCtx.Provider>
  );
}

/* Who is signed in, a way to sign in for comments, and the classic board. Kept small and to the side. */
function Account() {
  const { entry, cred, signOut, signedIn } = useAuth();
  const L = useLocalMaybe();
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setSigning(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSigning(false); } };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', off); window.removeEventListener('keydown', esc); };
  }, [open]);
  const email = cred.session?.email;
  const viewer = L && !L.canAct;
  const classic = classicUrl(entry, cred.token);
  return (
    <div className="relative" ref={box}>
      <button className="h-[30px] pl-1 pr-2.5 rounded-full border hair inline-flex items-center gap-1.5 text-[12.5px] text-soft hover:text-ink hover:border-[var(--line-bold)]"
        aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(o => !o)} data-testid="account">
        <span className="h-[22px] w-[22px] rounded-full bg-sunk inline-flex items-center justify-center text-[10.5px] font-semibold text-soft">
          {email ? email.slice(0, 1).toUpperCase() : <UserRound size={13} />}
        </span>
        <span className="max-sm:hidden truncate max-w-[180px]">{email ? (L?.model.nameOf(email) || email) : 'Sign in'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-[300px] rounded-[14px] border hair bg-paper p-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
          {email ? (
            <div className="px-1 pb-3 border-b hair">
              <div className="text-[12px] text-mute">Signed in as</div>
              <div className="text-[13.5px] text-ink truncate">{email}</div>
              {viewer && <div className="mt-1 text-[12px] text-mute">View only. You can read and comment.</div>}
            </div>
          ) : signing ? (
            <div className="px-1 pb-3 border-b hair">
              <SignInForm slug={entry.slug} compact onAuthed={s => { signedIn(s); setSigning(false); setOpen(false); }}
                intro={<p className="text-[12.5px] text-soft leading-[1.5]">Comments carry your name, so they need your email once.</p>} />
            </div>
          ) : (
            <div className="px-1 pb-3 border-b hair">
              <div className="text-[13px] text-ink">You opened the board with its link.</div>
              <button className="btn btn-outline btn-sm w-full mt-2.5" onClick={() => setSigning(true)} data-testid="account-signin">Sign in with your email</button>
              <p className="mt-2 text-[12px] text-mute leading-[1.45]">Needed to comment. Everything else works with the link.</p>
            </div>
          )}
          <div className="pt-2 grid">
            <a role="menuitem" href={classic} onClick={() => { track('classic'); flushNow(); }} className="h-9 px-1 rounded-[8px] inline-flex items-center gap-2 text-[13px] text-soft hover:text-ink" data-testid="classic-link">
              <ExternalLink size={14} /> Classic board
              <span className="ml-auto text-[11.5px] text-mute">team, photos, newsletter</span>
            </a>
            {email && (
              <button role="menuitem" onClick={() => { setOpen(false); signOut(); }} className="h-9 px-1 rounded-[8px] inline-flex items-center gap-2 text-[13px] text-soft hover:text-ink text-left">
                <LogOut size={14} /> Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Shell chrome: 56px icon rail on desktop, bottom tab bar on phone, one quiet header. */
function Chrome({ view, go, wordmark, logo, live = false }: { view: View; go: (v: View) => void; wordmark: string; logo?: string; live?: boolean }) {
  const phone = useIsPhone();
  const { entry } = useAuth();
  const [hover, setHover] = useState<View | null>(null);
  const [logoBad, setLogoBad] = useState(false);
  const t = themeFor(entry.slug);
  // A dark logo on dark paper disappears, so dark boards use the wordmark only.
  const showLogo = !!logo && !logoBad && (!t.dark || entry.slug === 'arch-agency');
  const devSwitch = import.meta.env.DEV && DEV_BOARDS.length > 0;
  return (
    <>
      {!phone && (
        <nav className="rail fixed left-0 top-0 bottom-0 z-40 border-r hair bg-paper flex flex-col items-center" aria-label="Board">
          <div className="h-14 w-full flex items-center justify-center border-b hair">
            <span className="h-8 w-8 rounded-[9px] inline-flex items-center justify-center font-display text-[15px]" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }}>{wordmark.slice(0, 1)}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 pt-4" onMouseLeave={() => setHover(null)}>
            {VIEWS.map(({ id, label, Icon }) => (
              <button key={id} className="rail-btn" aria-current={view === id ? 'page' : undefined} aria-label={label}
                onClick={() => go(id)} onMouseEnter={() => setHover(id)} data-testid={`nav-${id}`}>
                {(hover ?? view) === id && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-[12px] bg-sunk" transition={SPRING} />}
                {view === id && <motion.span layoutId="rail-bar" className="absolute -left-2 top-2 bottom-2 w-[2px] rounded-full bg-accent" transition={SPRING} />}
                <Icon size={19} strokeWidth={1.6} className="relative" />
                <span className="rail-tip">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <header className="sticky top-0 z-30 h-14 bg-paper border-b hair md:pl-[var(--rail)]">
        <div className="h-full px-4 sm:px-8 flex items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {showLogo && <img src={logo} alt="" onError={() => setLogoBad(true)} className="h-7 w-7 rounded-[7px] object-cover" />}
            <span className="font-display text-head text-[18px] truncate" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>{wordmark}</span>
            <span className="text-[13px] text-mute max-md:hidden">Content board</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 min-w-0">
            {devSwitch && (
              <label className="relative inline-flex items-center gap-2">
                <span className="eyebrow max-lg:hidden !text-[10px]">Dev board</span>
                <select className="pill-select" value={entry.slug} onChange={e => { if (e.target.value !== entry.slug) location.assign(`?board=${e.target.value}&view=${view}`); }} aria-label="Switch dev board">
                  {DEV_BOARDS.map(b => <option key={b.slug} value={b.slug}>{SHORT[b.slug] || b.slug}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mute" width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              </label>
            )}
            {live && <Account />}
          </div>
        </div>
      </header>

      {phone && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-paper border-t hair pb-[env(safe-area-inset-bottom)]" aria-label="Board">
          <div className="grid grid-cols-5">
            {VIEWS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => go(id)} aria-current={view === id ? 'page' : undefined}
                className={`relative h-[60px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${view === id ? 'text-ink' : 'text-mute'}`}>
                {view === id && <motion.span layoutId="tab-bar" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-accent" transition={SPRING} />}
                <Icon size={20} strokeWidth={1.6} />
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
