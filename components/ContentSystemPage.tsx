import React from 'react';
import { useMetadata } from '../hooks/useMetadata';

const PRODUCT_URL = 'https://inboundonsteroids.com/';

// The inbound engine now lives on its own product domain. This route stays
// registered so old DM and post links keep resolving, but it redirects to the
// product site and shows a minimal fallback link if the redirect is blocked.
export default function ContentSystemPage() {
  useMetadata({
    title: 'Inbound Engine | Manfredi',
    description:
      'An always-on inbound engine that posts daily in your voice, refuses to publish AI slop, and turns the readers who engage into named leads in your inbox.',
    canonical: PRODUCT_URL,
  });

  React.useEffect(() => {
    window.location.replace(PRODUCT_URL);
  }, []);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 text-center">
      <a href={PRODUCT_URL} className="text-lg text-ink underline hover:text-black">
        Continue to InboundOnSteroids
      </a>
    </div>
  );
}
