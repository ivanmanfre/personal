// components/ui/linkedInFeedMockup.fixtures.ts
import type { FeedSpec } from '../../lib/linkedinFeedSpec';

/** Sample prospect feed for dev preview + visual testing. Stand-in data, not a real person. */
export const sampleFeedSpec: FeedSpec = {
  profile: {
    name: 'Jordan Vega',
    headline: 'Founder & CEO at Northwind Creative · Brand systems for B2B',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
  },
  posts: [
    {
      type: 'text',
      body: `Most agencies pitch "brand strategy" and deliver a logo.\n\nThe gap isn't talent. It's that strategy lives in a deck nobody reads after kickoff.\n\nWe started shipping a one-page operating brief instead — the 3 decisions every asset has to honor. Adoption went from "sometimes" to "every time."\n\nDeliverables don't change behavior. Constraints do.`,
      reactions: 214,
      comments: 18,
    },
    {
      type: 'text',
      body: `A client asked last week why our retainer costs more than the shop down the street.\n\nSimple: they're paying for the shop's busywork. We deleted 40% of ours.\n\nThe most expensive thing in any agency is work that looks like progress.`,
      reactions: 176,
      comments: 11,
    },
    {
      type: 'image',
      body: `The 3-layer brand system we install for every founder-led B2B account. Save this one.`,
      imageUrl: 'https://placehold.co/1200x900/2A8F65/FFFFFF/png?text=Brand+System',
      reactions: 309,
      comments: 27,
    },
  ],
  lmCard: {
    coverUrl: 'https://placehold.co/800x1000/1A1A1A/F7F4EF/png?text=Founder+Brand+Playbook',
    title: 'The Founder Brand Playbook',
    pages: 9,
  },
};
