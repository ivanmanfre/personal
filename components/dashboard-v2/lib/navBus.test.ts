import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchNav, onNav, type NavDetail } from './navBus';

describe('navBus', () => {
  beforeEach(() => {
    // jsdom not enabled (node env); provide a minimal EventTarget-backed window shim.
    (globalThis as any).window = new EventTarget();
    if (!(globalThis as any).CustomEvent) {
      (globalThis as any).CustomEvent = class<T> extends Event { detail: T; constructor(t: string, o: any){ super(t); this.detail = o?.detail; } };
    }
  });

  it('delivers section + sub to subscribers', () => {
    const seen: NavDetail[] = [];
    const off = onNav((d) => seen.push(d));
    dispatchNav({ section: 'content', sub: 'leadmagnets' });
    expect(seen).toEqual([{ section: 'content', sub: 'leadmagnets' }]);
    off();
  });

  it('stops delivering after unsubscribe', () => {
    const seen: NavDetail[] = [];
    const off = onNav((d) => seen.push(d));
    off();
    dispatchNav({ section: 'ops' });
    expect(seen).toEqual([]);
  });
});
