export type PlacedNode = {
  label: string;
  x: number; y: number; w: number; h: number;
  cx: number; cy: number;
};

export type DiagramLayout = {
  nodes: PlacedNode[];
  pathD: string;
  width: number;
  height: number;
};

// IBM Plex Mono ~0.6em advance + 0.08em tracking (renderer applies letterSpacing 0.08em) @ 11px
export const CHAR_W = 11 * (0.6 + 0.08);
export const PAD_X = 12;
export const NODE_H = 26;

export const nodeWidth = (label: string, maxW = Infinity): number =>
  Math.min(Math.ceil(label.length * CHAR_W) + PAD_X * 2, maxW);

export function horizontalLayout(labels: string[], width: number, height = 48): DiagramLayout {
  const widths = labels.map((l) => nodeWidth(l));
  const sum = widths.reduce((a, b) => a + b, 0);
  const gap = labels.length > 1 ? Math.max(16, (width - sum) / (labels.length - 1)) : 0;
  const cy = height / 2;
  let x = labels.length === 1 ? (width - widths[0]) / 2 : 0;
  const nodes: PlacedNode[] = labels.map((label, i) => {
    const w = widths[i];
    const n = { label, x, y: cy - NODE_H / 2, w, h: NODE_H, cx: x + w / 2, cy };
    x += w + gap;
    return n;
  });
  const last = nodes[nodes.length - 1];
  const pathD = `M ${nodes[0].x} ${cy} L ${last.x + last.w} ${cy}`;
  return { nodes, pathD, width: Math.max(width, x - gap), height };
}

export function serpentineLayout(labels: string[], width: number, height: number): DiagramLayout {
  const n = labels.length;
  const rowH = Math.max(height / n, NODE_H + 8); // never overlap rows
  const nodes: PlacedNode[] = labels.map((label, i) => {
    const w = nodeWidth(label, width * 0.8);
    const rawCx = i % 2 === 0 ? width * 0.38 : width * 0.62;
    // clamp so wide nodes never overflow the canvas
    const cx = Math.min(Math.max(rawCx, w / 2), width - w / 2);
    const cy = rowH * i + rowH / 2;
    return { label, x: cx - w / 2, y: cy - NODE_H / 2, w, h: NODE_H, cx, cy };
  });
  let d = `M ${nodes[0].cx} ${nodes[0].cy}`;
  for (let i = 1; i < n; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    const my = (a.cy + b.cy) / 2;
    d += ` C ${a.cx} ${my}, ${b.cx} ${my}, ${b.cx} ${b.cy}`;
  }
  return { nodes, pathD: d, width, height: Math.max(height, rowH * n) };
}
