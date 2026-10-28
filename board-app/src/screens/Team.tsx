import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mail, Trash2, UserPlus } from 'lucide-react';
import { api, errText, requestLink, type TeamRes } from '../data/api';
import type { Model } from '../data/model';
import { useAuth } from '../data/auth';
import { useLocal } from '../data/store';
import { track } from '../data/track';
import { Avatar, SPRING } from '../ui/kit';

type Role = Model['members'][number]['role'];
type Member = Model['members'][number];

const isOperator = (email: string) => /ivanmanfredi/.test(email);
const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/** What each role can do, in the board's own words. A buffer board (RISE) has no approve step. */
function roleCopy(m: Model): Record<Role, { label: string; hint: string }> {
  const buffer = m.theme.mode === 'buffer';
  return {
    admin: { label: 'Admin', hint: buffer ? 'Edits posts and manages the team' : 'Approves, edits and manages the team' },
    approver: { label: buffer ? 'Editor' : 'Approver', hint: buffer ? 'Edits, moves and comments on posts' : 'Approves, edits and comments on posts' },
    viewer: { label: 'Viewer', hint: 'Reads the board and comments' },
  };
}

const toMembers = (r: TeamRes, prev: Member[]): Member[] => (Array.isArray(r.members)
  ? r.members.filter(x => x.email).map(x => ({
      email: String(x.email).toLowerCase(), name: String(x.name || '').trim(),
      role: (x.role === 'admin' || x.role === 'viewer' ? x.role : 'approver') as Role, owner: !!x.owner,
    }))
  : prev);

export function TeamPage() {
  const { model: m, toast } = useLocal();
  const { cred } = useAuth();
  const roles = roleCopy(m);
  const [members, setMembers] = useState<Member[]>(m.members);
  const [cap, setCap] = useState(m.teamCap);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('approver');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  // A newer board read (focus, every 5 minutes) brings the server's list.
  useEffect(() => { setMembers(m.members); setCap(m.teamCap); }, [m.members, m.teamCap]);

  const me = (cred.session?.email || m.me || '').toLowerCase();
  const myRole: Role = cred.session?.token ? (members.find(x => x.email === me)?.role || (m.role as Role)) : 'admin';
  const admin = myRole === 'admin';
  const client = members.filter(x => !isOperator(x.email));
  const operators = members.filter(x => isOperator(x.email));

  const run = async (key: string, fn: () => Promise<TeamRes>, done: (r: TeamRes) => void) => {
    setBusy(key); setErr(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) { setErr(errText(r.error)); return false; }
    setMembers(prev => toMembers(r, prev));
    if (Number(r.cap) > 0) setCap(Number(r.cap));
    done(r);
    return true;
  };

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!emailOk(e) || busy) return;
    const nm = name.trim() || null;
    await run('add', () => api.teamAdd(cred, e, nm, role) as Promise<TeamRes>, r => {
      track('team_add', null, { role, named: !!nm, already: !!r.already_member });
      if (r.already_member) { toast(`${e} is already on the team`); return; }
      // The team list is the access. The email is the courtesy: a one-tap sign-in link.
      void requestLink(m.slug, e);
      toast(`${nm || e} is in. A sign-in email is on its way.`);
      setEmail(''); setName(''); setRole('approver');
    });
  };

  const remove = (x: Member) => run('rm:' + x.email, () => api.teamRemove(cred, x.email) as Promise<TeamRes>, () => {
    track('team_remove', null, { role: x.role });
    toast(`${x.name || x.email} no longer has access`);
    setConfirm(null);
  });

  const setTo = (x: Member, r: Role) => {
    if (r === x.role) return;
    void run('role:' + x.email, () => api.teamRole(cred, x.email, r) as Promise<TeamRes>, () => {
      track('team_role', null, { from: x.role, to: r });
      toast(`${x.name || x.email} is now ${roles[r].label.toLowerCase()}`);
    });
  };

  const row = (x: Member) => {
    const self = !!me && x.email === me;
    const locked = !admin || self || x.owner || isOperator(x.email);
    const label = x.name || x.email.split('@')[0];
    return (
      <motion.li layout key={x.email} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING}
        className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 border-t hair first:border-t-0" data-testid="team-row">
        <Avatar name={label} size={34} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-semibold text-ink truncate">{isOperator(x.email) ? 'Ivan Manfredi' : label}</span>
            {x.owner && <span className="chip chip-mute !h-[20px] !text-[10.5px]">Owner</span>}
            {self && <span className="chip chip-accent !h-[20px] !text-[10.5px]">You</span>}
          </div>
          <div className="text-[12.5px] text-mute truncate">{x.email}</div>
        </div>
        <div className="flex items-center gap-1.5 justify-self-end">
          {isOperator(x.email) ? (
            <span className="text-[12.5px] text-mute">Writes and schedules</span>
          ) : locked ? (
            <span className="text-[12.5px] text-soft" title={roles[x.role].hint}>{roles[x.role].label}</span>
          ) : (
            <>
              <label className="relative inline-flex">
                <span className="sr-only">Role for {label}</span>
                <select className="pill-select" value={x.role} disabled={!!busy} onChange={e => setTo(x, e.target.value as Role)} data-testid="team-role">
                  {(['admin', 'approver', 'viewer'] as Role[]).map(r => <option key={r} value={r}>{roles[r].label}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mute" width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              </label>
              {confirm === x.email ? (
                <span className="inline-flex items-center gap-1">
                  <button className="btn btn-sm btn-outline !h-[30px] !px-3" style={{ color: '#D92D20', borderColor: 'color-mix(in srgb, #D92D20 50%, transparent)' }}
                    disabled={!!busy} onClick={() => void remove(x)} data-testid="team-remove-confirm">{busy === 'rm:' + x.email ? 'Removing' : 'Remove'}</button>
                  <button className="btn btn-text btn-sm !h-[30px]" onClick={() => setConfirm(null)}>Keep</button>
                </span>
              ) : (
                <button className="h-[30px] w-[30px] rounded-full inline-flex items-center justify-center text-mute hover:text-ink hover:bg-sunk" aria-label={`Remove ${label}`}
                  onClick={() => setConfirm(x.email)} data-testid="team-remove"><Trash2 size={14} /></button>
              )}
            </>
          )}
        </div>
      </motion.li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 pt-6 sm:pt-8 pb-20">
      <div className="eyebrow mb-2">Who can open this board</div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-6">
        <h1 className="display text-[28px] sm:text-[32px]">Team</h1>
        <span className="text-[13px] text-mute tnum">{members.length} of {cap} seats</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 items-start">
        <div className="min-w-0 grid gap-6">
          <section className="rounded-[14px] border hair bg-raise overflow-hidden">
            <div className="px-4 py-3 border-b hair flex items-center justify-between">
              <span className="eyebrow">{m.company}</span>
              <span className="text-[12px] text-mute tnum">{client.length}</span>
            </div>
            <ul>
              <AnimatePresence initial={false}>{client.map(row)}</AnimatePresence>
            </ul>
            {!client.length && <p className="px-4 py-5 text-[13.5px] text-mute">No one from your side yet. Add someone on the right.</p>}
          </section>
          {operators.length > 0 && (
            <section className="rounded-[14px] border hair overflow-hidden">
              <div className="px-4 py-3 border-b hair"><span className="eyebrow">Your content team</span></div>
              <ul>{operators.map(row)}</ul>
            </section>
          )}
          {err && <p className="text-[13px]" style={{ color: '#D92D20' }} role="alert" data-testid="team-error">{err}</p>}
        </div>

        <aside className="min-w-0 grid gap-5">
          {admin ? (
            <form className="rounded-[14px] border hair p-4 grid gap-3" onSubmit={e => { e.preventDefault(); void invite(); }} data-testid="team-invite">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ink"><UserPlus size={16} /> Add someone</div>
              <label className="grid gap-1">
                <span className="text-[12px] text-mute">Work email</span>
                <input type="email" inputMode="email" autoComplete="off" required value={email} onChange={e => { setEmail(e.target.value); setErr(null); }} placeholder="name@company.com"
                  className="h-10 rounded-[10px] border hair bg-paper px-3 text-[14px] text-ink" data-testid="team-email" />
              </label>
              <label className="grid gap-1">
                <span className="text-[12px] text-mute">Name <span className="text-mute">(shown on comments)</span></span>
                <input type="text" autoComplete="off" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Optional"
                  className="h-10 rounded-[10px] border hair bg-paper px-3 text-[14px] text-ink" data-testid="team-name" />
              </label>
              <fieldset className="grid gap-1.5">
                <legend className="text-[12px] text-mute mb-1">What they can do</legend>
                {(['approver', 'viewer', 'admin'] as Role[]).map(r => (
                  <label key={r} className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2 cursor-pointer ${role === r ? 'border-[var(--accent-line)] bg-[var(--accent-wash)]' : 'hair'}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[var(--accent)]" />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink">{roles[r].label}</span>
                      <span className="block text-[12px] text-mute leading-snug">{roles[r].hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" className="btn btn-primary" disabled={!emailOk(email) || !!busy || members.length >= cap}
                style={!emailOk(email) || busy || members.length >= cap ? { opacity: 0.45 } : undefined} data-testid="team-add">
                {busy === 'add' ? 'Adding' : <><Mail size={15} /> Add and email a sign-in link</>}
              </button>
              <p className="text-[12px] text-mute leading-[1.5]">No passwords. They get a one-tap link and can sign in again later with the same email.</p>
            </form>
          ) : (
            <div className="rounded-[14px] border hair p-4">
              <div className="text-[14px] font-semibold text-ink">Need someone added?</div>
              <p className="mt-1.5 text-[13px] text-soft leading-[1.5]">Ask an admin on your team. You are {roles[myRole].label.toLowerCase()}: {roles[myRole].hint.toLowerCase()}.</p>
            </div>
          )}
          <div className="rounded-[14px] border hair p-4">
            <div className="eyebrow mb-3">Roles</div>
            <ul className="grid gap-2.5">
              {(['admin', 'approver', 'viewer'] as Role[]).map(r => (
                <li key={r} className="flex gap-2.5 text-[13px]">
                  <Check size={14} className="mt-[3px] text-accent-fg shrink-0" />
                  <span><span className="font-semibold text-ink">{roles[r].label}</span> <span className="text-soft">· {roles[r].hint}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
