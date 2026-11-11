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

/* ---- Changes inside the post: paragraphs lined up, reworded ones compared word by word. ---- */
export type Seg = { kind: 'same' | 'add' | 'del'; text: string };

const words = (s: string) => s.match(/\S+\s*/g) || [];

/** Word diff of one paragraph. Each word keeps its trailing space, so the pieces read as running text. */
export function diffWords(before: string, after: string): Seg[] {
  const a = words(before), b = words(after);
  const n = a.length, m = b.length;
  const eq = (x: string, y: string) => x.trim() === y.trim();
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const raw: Seg[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { raw.push({ kind: 'same', text: b[j] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) raw.push({ kind: 'del', text: a[i++] });
    else raw.push({ kind: 'add', text: b[j++] });
  }
  while (i < n) raw.push({ kind: 'del', text: a[i++] });
  while (j < m) raw.push({ kind: 'add', text: b[j++] });
  // Within one changed run, show what went before what came, then join neighbours of a kind.
  const out: Seg[] = [];
  let k = 0;
  const push = (kind: Seg['kind'], text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text; else out.push({ kind, text });
  };
  while (k < raw.length) {
    if (raw[k].kind === 'same') { push('same', raw[k].text); k++; continue; }
    let del = '', add = '';
    while (k < raw.length && raw[k].kind !== 'same') { if (raw[k].kind === 'del') del += raw[k].text; else add += raw[k].text; k++; }
    // A removed run keeps a space on both sides, so struck text never glues to the word before or after it.
    const prev = out[out.length - 1];
    if (del && prev && !/\s$/.test(prev.text)) del = ' ' + del;
    push('del', del && !/\s$/.test(del) && (add || k < raw.length) ? del + ' ' : del);
    push('add', add);
  }
  return out;
}

export type Block =
  | { kind: 'same'; text: string; line: number; baseLine: number }
  | { kind: 'add'; text: string; line: number }
  | { kind: 'del'; text: string; baseLine: number }
  | { kind: 'change'; text: string; line: number; before: string; baseLine: number; segs: Seg[] };

/* How alike two paragraphs are, 0 to 1, by shared words. */
function alike(x: string, y: string) {
  const a = words(x.toLowerCase()).map(w => w.trim()), b = words(y.toLowerCase()).map(w => w.trim());
  if (!a.length || !b.length) return 0;
  const left = new Map<string, number>();
  for (const w of a) left.set(w, (left.get(w) || 0) + 1);
  let hit = 0;
  for (const w of b) { const c = left.get(w) || 0; if (c > 0) { hit++; left.set(w, c - 1); } }
  return (2 * hit) / (a.length + b.length);
}

/** The post as blocks: unchanged, added, removed, or reworded (with its word diff).
    `line` is the paragraph's index in the text as it reads now; `baseLine` its index in the text before. */
export function diffBlocks(before: string, after: string): Block[] {
  let ai = 0, bi = 0;
  const rows = diffLines(before, after).map(x => (x.kind === 'same' ? { ...x, a: ai++, b: bi++ } : x.kind === 'del' ? { ...x, a: ai++, b: -1 } : { ...x, a: -1, b: bi++ }));
  const out: Block[] = [];
  let k = 0;
  while (k < rows.length) {
    if (rows[k].kind === 'same') { out.push({ kind: 'same', text: rows[k].text, line: rows[k].b, baseLine: rows[k].a }); k++; continue; }
    const dels: typeof rows = [], adds: typeof rows = [];
    while (k < rows.length && rows[k].kind !== 'same') { (rows[k].kind === 'del' ? dels : adds).push(rows[k]); k++; }
    // Pair each added paragraph with the removed one it rewords, in order.
    const pair = new Map<number, number>();
    let from = 0;
    adds.forEach((ad, x) => {
      if (!ad.text.trim()) return;
      for (let y = from; y < dels.length; y++) {
        if (dels[y].text.trim() && alike(dels[y].text, ad.text) >= 0.5) { pair.set(x, y); from = y + 1; break; }
      }
    });
    const del = (y: number) => out.push({ kind: 'del', text: dels[y].text, baseLine: dels[y].a });
    let done = 0;
    const first = pair.size ? Math.min(...pair.values()) : dels.length;
    for (; done < first; done++) del(done);
    adds.forEach((ad, x) => {
      const y = pair.get(x);
      if (y == null) { out.push({ kind: 'add', text: ad.text, line: ad.b }); return; }
      for (; done < y; done++) del(done);
      out.push({ kind: 'change', text: ad.text, line: ad.b, before: dels[y].text, baseLine: dels[y].a, segs: diffWords(dels[y].text, ad.text) });
      done = y + 1;
    });
    for (; done < dels.length; done++) del(done);
  }
  return out;
}
