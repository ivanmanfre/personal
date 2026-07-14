// hooks/useGoogleFonts.ts
// Guarded Google Fonts injector for prospect brand fonts. Sample artifacts (carousel
// slides, image cards) render in the PROSPECT's font_heading/font_body, which come from
// the brand profiler as plain family names (e.g. "Fraunces"). This hook injects one
// <link> per family, once per page, and skips generic/system families. Renderers keep
// full fallback stacks so nothing breaks while the font loads (or if it never does).
import { useEffect } from 'react';

// Families that are never on Google Fonts (system stacks / generic keywords) — skip.
const SKIP = new Set([
  'system-ui', '-apple-system', 'blinkmacsystemfont', 'sans-serif', 'serif', 'monospace',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy', 'inherit', 'initial',
  'arial', 'helvetica', 'helvetica neue', 'georgia', 'times', 'times new roman',
  'courier', 'courier new', 'verdana', 'tahoma', 'segoe ui',
]);

const injected = new Set<string>();

/** Extract the first concrete family from a possibly-stacked value ("Fraunces, serif"). */
function firstFamily(value?: string | null): string | null {
  if (!value) return null;
  const fam = value.split(',')[0].replace(/["']/g, '').trim();
  if (!fam || fam.length > 60) return null;
  if (SKIP.has(fam.toLowerCase())) return null;
  // Family names are word characters, spaces and a few safe marks — reject anything else.
  if (!/^[\w\s.+-]+$/.test(fam)) return null;
  return fam;
}

export function useGoogleFonts(families: Array<string | null | undefined>): void {
  const key = families.filter(Boolean).join('|');
  useEffect(() => {
    if (typeof document === 'undefined') return;
    for (const raw of families) {
      const fam = firstFamily(raw);
      if (!fam || injected.has(fam)) continue;
      injected.add(fam);
      const id = 'gf-' + fam.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@400;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
    // Injected links stay for the page's lifetime by design (fonts are page-global).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default useGoogleFonts;
