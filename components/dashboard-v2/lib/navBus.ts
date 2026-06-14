// Decoupled cross-section navigation. Shell listens for `section`; ContentStudio listens for `sub`.
export type SectionId =
  | 'briefing' | 'content' | 'reach' | 'ops' | 'clients'
  | 'knowledge' | 'agent' | 'ideas' | 'system' | 'personal';

export interface NavDetail {
  section: SectionId;
  sub?: string;
}

const EVENT = 'dv:navigate';

export function dispatchNav(detail: NavDetail): void {
  window.dispatchEvent(new CustomEvent<NavDetail>(EVENT, { detail }));
}

export function onNav(handler: (detail: NavDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<NavDetail>).detail);
  window.addEventListener(EVENT, listener as EventListener);
  return () => window.removeEventListener(EVENT, listener as EventListener);
}
