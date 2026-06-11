import { describe, it, expect } from 'vitest';
import { nodeWidth, horizontalLayout, serpentineLayout, NODE_H } from './layout';

describe('nodeWidth', () => {
  it('grows with label length and respects max', () => {
    expect(nodeWidth('ab')).toBeLessThan(nodeWidth('abcdefgh'));
    expect(nodeWidth('a very very long label', 80)).toBe(80);
  });
});

describe('horizontalLayout', () => {
  const labels = ['call', 'transcript', 'rubric', 'route'];
  const l = horizontalLayout(labels, 380);

  it('places one node per label, left to right', () => {
    expect(l.nodes).toHaveLength(4);
    for (let i = 1; i < l.nodes.length; i++) {
      expect(l.nodes[i].x).toBeGreaterThan(l.nodes[i - 1].x + l.nodes[i - 1].w);
    }
  });

  it('centers nodes vertically and reports geometry', () => {
    for (const n of l.nodes) {
      expect(n.cy).toBe(l.height / 2);
      expect(n.h).toBe(NODE_H);
      expect(n.cx).toBeCloseTo(n.x + n.w / 2);
    }
  });

  it('path runs the full pipeline', () => {
    const last = l.nodes[l.nodes.length - 1];
    expect(l.pathD.startsWith('M ')).toBe(true);
    expect(l.pathD).toContain(`L ${last.x + last.w}`);
  });
});

describe('serpentineLayout', () => {
  const labels = ['call recorded', 'transcribed', 'graded vs 8-criteria rubric', 'risk flagged', 'routed < 1 hr'];
  const l = serpentineLayout(labels, 420, 520);

  it('alternates sides and descends monotonically', () => {
    for (let i = 1; i < l.nodes.length; i++) {
      expect(l.nodes[i].cy).toBeGreaterThan(l.nodes[i - 1].cy);
      expect(Math.sign(l.nodes[i].cx - 210)).not.toBe(Math.sign(l.nodes[i - 1].cx - 210));
    }
  });

  it('keeps nodes inside the canvas', () => {
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(420);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y + n.h).toBeLessThanOrEqual(520);
    }
  });

  it('builds a cubic path through every node', () => {
    expect(l.pathD.startsWith('M ')).toBe(true);
    expect(l.pathD.split(' C ')).toHaveLength(labels.length); // M + (n-1) C segments
  });
});

describe('clamp branches', () => {
  it('horizontal: narrow width floors the gap at 16 and grows the reported width', () => {
    const l = horizontalLayout(['alpha', 'bravo', 'charlie', 'delta'], 120);
    for (let i = 1; i < l.nodes.length; i++) {
      expect(l.nodes[i].x - (l.nodes[i - 1].x + l.nodes[i - 1].w)).toBeCloseTo(16);
    }
    expect(l.width).toBeGreaterThan(120);
  });

  it('serpentine: wide labels at narrow width stay inside the canvas', () => {
    const l = serpentineLayout(['graded vs 8-criteria rubric', 'ok'], 200, 300);
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(200);
    }
  });

  it('serpentine: tiny height grows rows instead of overlapping', () => {
    const l = serpentineLayout(['a', 'b', 'c', 'd', 'e'], 300, 60);
    for (const n of l.nodes) expect(n.y).toBeGreaterThanOrEqual(0);
    expect(l.height).toBeGreaterThanOrEqual(5 * 26);
  });

  it('single label: horizontal centers the node, both layouts produce valid paths', () => {
    const h = horizontalLayout(['call'], 300);
    expect(h.nodes[0].x).toBeCloseTo((300 - h.nodes[0].w) / 2);
    expect(h.pathD.startsWith('M ')).toBe(true);
    const s = serpentineLayout(['call'], 300, 100);
    expect(s.pathD.startsWith('M ')).toBe(true);
  });
});
