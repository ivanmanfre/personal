/** Local proposal content. Never written back to a sent scan. */
export type StoryKind = 'creative' | 'research' | 'custom';

export function storyKind(slug: string): StoryKind | null {
  return slug === 'luiza-vass-8c' ? 'creative' : slug === 'andrew-hayes-94' ? 'research' : null;
}

export const connectedStories = {
  creative: { buyer: 'A producer' },
  research: { buyer: 'A brand manager' },
} as const;
