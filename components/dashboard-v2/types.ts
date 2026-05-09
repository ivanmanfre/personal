/**
 * Dashboard v2 type definitions.
 * Section IDs are stable URL slugs — used in `?section=...&sub=...`.
 */

export type SectionId =
  | 'briefing'
  | 'content'
  | 'reach'
  | 'ops'
  | 'clients'
  | 'knowledge'
  | 'agent'
  | 'personal';

export type Severity = 'good' | 'warn' | 'bad' | 'neutral';

export interface NavItem {
  id: SectionId;
  name: string;
  emphasis?: string;       // <em> portion of name, sage-colored
  badge?: { count: number; severity: Severity };
  num?: string;            // sidebar marker (01, 02, ⊙, etc.)
  group?: 'briefing' | 'operate' | 'knowledge' | 'personal';
}

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;           // ⌘0, ⌘1, →, etc.
  group?: string;
  onSelect: () => void;
}
