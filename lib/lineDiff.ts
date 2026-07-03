export type DiffOp = { type: 'ctx' | 'add' | 'del'; text: string };

function splitLines(s: string): string[] {
  return s.split('\n');
}

/**
 * Minimal LCS line diff between two prompt bodies. Returns an ordered list of
 * ops: 'ctx' (unchanged), 'del' (only in old), 'add' (only in new). Empty-string
 * inputs are treated as "no content" on that side (an add-only / del-only diff),
 * except two empty strings which yield a single empty context line.
 */
export function lineDiff(oldStr: string, newStr: string): DiffOp[] {
  if (oldStr === '' && newStr === '') return [{ type: 'ctx', text: '' }];
  if (oldStr === '') return splitLines(newStr).map((text) => ({ type: 'add', text }));
  if (newStr === '') return splitLines(oldStr).map((text) => ({ type: 'del', text }));

  const a = splitLines(oldStr);
  const b = splitLines(newStr);
  const m = a.length;
  const n = b.length;

  // LCS length table, filled from the bottom-right.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'ctx', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: 'del', text: a[i++] });
  while (j < n) out.push({ type: 'add', text: b[j++] });
  return out;
}

export function diffStats(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'del') removed++;
  }
  return { added, removed };
}
