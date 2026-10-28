import { createContext, useContext } from 'react';
import type { Model } from '../data/model';

export type View = 'home' | 'posts' | 'content' | 'outreach' | 'activity' | 'team';
export type PeopleKind = 'booked' | 'positive' | 'replied' | 'reached';

export type Nav = {
  model: Model;
  view: View;
  go: (v: View) => void;
  openFocus: (postId?: string) => void;
  openPost: (postId: string, edit?: boolean) => void;
  openPeople: (k: PeopleKind) => void;
};

export const NavCtx = createContext<Nav | null>(null);
export function useNav() {
  const c = useContext(NavCtx);
  if (!c) throw new Error('NavCtx missing');
  return c;
}
