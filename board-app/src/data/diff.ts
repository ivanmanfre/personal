// Line diff (longest common subsequence). Blank lines are kept so paragraphs line up.
export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ kind: 'del', text: a[i++] });
    else out.push({ kind: 'add', text: b[j++] });
  }
  while (i < n) out.push({ kind: 'del', text: a[i++] });
  while (j < m) out.push({ kind: 'add', text: b[j++] });
  return out;
}

/* Only the changed lines and one line of context around them, blank lines dropped. */
export function diffHunks(d: DiffLine[]): (DiffLine | { kind: 'gap' })[] {
  const changed = (k: number) => !!d[k] && d[k].kind !== 'same';
  const keep = d.map((_, i) => changed(i) || changed(i - 1) || changed(i + 1));
  const out: (DiffLine | { kind: 'gap' })[] = [];
  d.forEach((x, i) => {
    if (!x.text.trim() && x.kind === 'same') return;
    if (keep[i]) out.push(x);
    else if (out.length && out[out.length - 1].kind !== 'gap') out.push({ kind: 'gap' });
  });
  while (out.length && out[out.length - 1].kind === 'gap') out.pop();
  return out;
}
