import { createContext, useContext } from 'react';
import type { Cred } from './api';
import type { Entry } from './entry';
import type { BoardSession } from './session';

export type Auth = {
  entry: Entry;
  cred: Cred;
  /** A fresh sign-in (inline code or the full screen): stored like the live board, then the board reads again. */
  signedIn: (s: BoardSession) => void;
  signOut: () => void;
};

export const AuthCtx = createContext<Auth | null>(null);
export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthCtx missing');
  return c;
}
