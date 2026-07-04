// lib/imagePresets.ts
export interface Chip { label: string; prompt: string; op: 'erase' | 'replace' | 'refine'; }
export interface CommandIntent { op: 'refine'; prompt: string; wholeImage: true; }

const GENERIC: Chip[] = [
  { label: 'Remove it', prompt: 'remove this object cleanly and fill the background naturally', op: 'erase' },
  { label: 'Make it brighter', prompt: 'brighten this region', op: 'refine' },
  { label: 'Different color', prompt: 'change the color of this object', op: 'replace' },
  { label: 'Replace with…', prompt: '', op: 'replace' },
];

const BY_CLASS: Record<string, Chip[]> = {
  laptop: [
    { label: 'Remove the laptop', prompt: 'remove the laptop cleanly and fill the surface naturally', op: 'erase' },
    { label: 'Different laptop', prompt: 'replace with a modern laptop', op: 'replace' },
    { label: 'Close the lid', prompt: 'show the laptop with its lid closed', op: 'refine' },
    { label: 'Replace with…', prompt: '', op: 'replace' },
  ],
  person: [
    { label: 'Remove them', prompt: 'remove this person cleanly and reconstruct the background', op: 'erase' },
    { label: 'Change the shirt', prompt: 'change the shirt color', op: 'refine' },
    { label: 'Replace with…', prompt: '', op: 'replace' },
  ],
  text: [
    { label: 'Remove this text', prompt: 'remove this text and fill the background', op: 'erase' },
    { label: 'Make it bolder', prompt: 'make this text bolder and higher contrast', op: 'refine' },
    { label: 'Replace with…', prompt: '', op: 'replace' },
  ],
};

export function chipsForClass(objectClass: string | undefined): Chip[] {
  if (!objectClass) return GENERIC;
  return BY_CLASS[objectClass.toLowerCase()] ?? GENERIC;
}

export function parseCommand(text: string): CommandIntent | null {
  const prompt = text.trim();
  if (!prompt) return null;
  return { op: 'refine', prompt, wholeImage: true };
}
