import React from 'react';

export type FontOption = {
  id: string;
  label: string;
  family: string;
  weight: number;
  letterSpacing?: string;
  // Optical correction — some serifs read 5–10% larger than others
  scaleAdjust?: number;
  notes?: string;
};

// Curated headline display serifs — closest free analogs to PP Editorial New
// up through more dramatic Didone alternatives. Ordered roughly from
// "warm humanist" → "high-contrast Didone" → "transitional / classical."
export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'instrument',
    label: 'Instrument Serif',
    family: '"Instrument Serif", serif',
    weight: 400,
    letterSpacing: '-0.015em',
    notes: 'Modern editorial · pinched terminals',
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    family: '"Fraunces", serif',
    weight: 500,
    letterSpacing: '-0.02em',
    scaleAdjust: 0.95,
    notes: 'Humanist · soft warmth',
  },
  {
    id: 'newsreader',
    label: 'Newsreader',
    family: '"Newsreader", serif',
    weight: 500,
    letterSpacing: '-0.01em',
    notes: 'NYT magazine · open counters',
  },
  {
    id: 'bodoni',
    label: 'Bodoni Moda',
    family: '"Bodoni Moda", serif',
    weight: 500,
    letterSpacing: '-0.015em',
    scaleAdjust: 0.92,
    notes: 'High-contrast Didone · dramatic',
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    family: '"Playfair Display", serif',
    weight: 500,
    letterSpacing: '-0.015em',
    scaleAdjust: 0.92,
    notes: 'Classic display · transitional',
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    family: '"Cormorant Garamond", serif',
    weight: 500,
    letterSpacing: '-0.01em',
    scaleAdjust: 1.05,
    notes: 'Garalde revival · elegant',
  },
  {
    id: 'crimson',
    label: 'Crimson Pro',
    family: '"Crimson Pro", serif',
    weight: 500,
    letterSpacing: '-0.01em',
    notes: 'Old-style book serif',
  },
  {
    id: 'spectral',
    label: 'Spectral',
    family: '"Spectral", serif',
    weight: 500,
    letterSpacing: '-0.01em',
    notes: 'Editorial reading serif',
  },
  {
    id: 'caslon',
    label: 'Libre Caslon',
    family: '"Libre Caslon Text", serif',
    weight: 400,
    letterSpacing: '-0.01em',
    scaleAdjust: 0.92,
    notes: 'Caslon revival · classical',
  },
  {
    id: 'eb-garamond',
    label: 'EB Garamond',
    family: '"EB Garamond", serif',
    weight: 500,
    letterSpacing: '-0.005em',
    scaleAdjust: 1.0,
    notes: 'Old-style · academic',
  },
  {
    id: 'dmserif',
    label: 'DM Serif Display',
    family: '"DM Serif Display", serif',
    weight: 400,
    letterSpacing: '-0.02em',
    scaleAdjust: 0.92,
    notes: 'Didone display · poster-grade',
  },
  {
    id: 'italiana',
    label: 'Italiana',
    family: '"Italiana", serif',
    weight: 400,
    letterSpacing: '0em',
    scaleAdjust: 1.05,
    notes: 'Hairline Didone · couture',
  },
];

// Pulls the persisted font choice from localStorage (so it survives HMR/refresh)
const STORAGE_KEY = 'hero-font-choice-v1';

export function useFontPicker(scopeId: string, defaultId: string = 'instrument'): [FontOption, React.FC] {
  const [chosen, setChosen] = React.useState<string>(() => {
    if (typeof window === 'undefined') return defaultId;
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return map[scopeId] || defaultId;
    } catch {
      return defaultId;
    }
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      map[scopeId] = chosen;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }, [chosen, scopeId]);

  const option = FONT_OPTIONS.find((f) => f.id === chosen) ?? FONT_OPTIONS[0];

  const Picker: React.FC = React.useCallback(
    () => (
      <div
        className="absolute top-4 right-4 z-50 flex flex-col gap-1"
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        <div
          className="mb-1 px-3"
          style={{ color: 'rgba(26,26,26,0.5)' }}
        >
          Headline font · {option.notes}
        </div>
        <div
          className="px-2 py-2 backdrop-blur-md rounded"
          style={{
            backgroundColor: 'rgba(247,244,239,0.85)',
            border: '1px solid rgba(26,26,26,0.12)',
            maxWidth: '280px',
          }}
        >
          <div className="flex flex-wrap gap-1">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setChosen(f.id)}
                className="px-2 py-1 transition-colors text-[10px]"
                style={{
                  backgroundColor: chosen === f.id ? '#1A1A1A' : 'transparent',
                  color: chosen === f.id ? '#F7F4EF' : '#1A1A1A',
                  border: '1px solid rgba(26,26,26,0.2)',
                  letterSpacing: '0.1em',
                  fontFamily: f.family,
                  fontStyle: 'italic',
                  textTransform: 'none',
                  fontSize: '11px',
                }}
                title={f.label}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    [chosen, option.notes]
  );

  return [option, Picker];
}
