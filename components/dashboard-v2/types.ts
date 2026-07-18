/**
 * Dashboard v2 type definitions.
 * Section IDs are stable URL slugs — used in `?section=...&sub=...`.
 */

// Round 2 (A-seed) widens section ids to arbitrary slugs so every legacy
// category and its subsections can each own a distinct, clickable nav home
// (Ivan feedback #1). Legacy literals are documented in LEGACY_SECTION_REMAP.
export type SectionId = string;

export type Severity = 'good' | 'warn' | 'bad' | 'neutral';

export interface NavItem {
  id: SectionId;
  name: string;
  emphasis?: string;       // <em> portion of name, sage-colored
  badge?: { count: number; severity: Severity };
  num?: string;            // sidebar marker (01, 02, ⊙, etc.)
  // Round 2: grouped nav. `group` is a group KEY; the divider label + order
  // come from the groups config in Sidebar. Legacy 4-bucket values still work.
  group?: string;
}

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;           // ⌘0, ⌘1, →, etc.
  group?: string;
  onSelect: () => void;
}
