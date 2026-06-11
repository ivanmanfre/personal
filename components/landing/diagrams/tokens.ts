// Diagram language tokens — canonical values for the brand's system-diagram
// vocabulary. Mirrored in brand-visual-system.md (Diagram Language section);
// if a value changes here, change it there in the same commit.
export const DIAGRAM = {
  ink: 'rgba(26,26,26,0.35)',        // node stroke, resting
  inkDone: '#1A1A1A',                // node stroke after the signal passes
  connector: 'rgba(26,26,26,0.25)',  // base connector line
  sage: '#2A8F65',                   // THE signal path — one lit path per diagram
  pink: '#E8366D',                   // before/failure states ONLY
  paper: '#F7F4EF',                  // node fill (hides the connector behind nodes)
  label: '#5A5752',                  // mono label color
  nodeStroke: 1,
  signalStroke: 1.5,
  pulseLen: 26,                      // px length of the traveling sage dash
  tick: 6,                           // sage corner square size (node done-state)
  font: '"IBM Plex Mono", monospace',
  fontSize: 11,                      // floor for HTML/UI text; scaled SVG diagram labels may render smaller — keep ≥8px effective
  easeCss: 'cubic-bezier(0.22, 0.84, 0.36, 1)',
} as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
