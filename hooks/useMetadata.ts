import { useEffect } from 'react';

interface MetadataOptions {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * Sets document.title and relevant meta tags per-page.
 * Resets head tags to index.html defaults when the component unmounts
 * so SPA navigation doesn't leak stale meta between routes.
 */
function setMetaContent(selector: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (el) el.content = content;
}

export function useMetadata({ title, description, canonical, ogImage, noindex }: MetadataOptions) {
  useEffect(() => {
    const prevTitle = document.title;

    document.title = title;

    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    if (canonical) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
      setMetaContent('meta[property="og:url"]', canonical);
    }

    if (ogImage) {
      setMetaContent('meta[property="og:image"]', ogImage);
      setMetaContent('meta[name="twitter:image"]', ogImage);
    }

    let robotsEl: HTMLMetaElement | null = null;
    if (noindex) {
      robotsEl = document.createElement('meta');
      robotsEl.name = 'robots';
      robotsEl.content = 'noindex, nofollow';
      document.head.appendChild(robotsEl);
    }

    return () => {
      document.title = prevTitle;
      if (robotsEl && robotsEl.parentNode) robotsEl.parentNode.removeChild(robotsEl);
    };
  }, [title, description, canonical, ogImage, noindex]);
}
