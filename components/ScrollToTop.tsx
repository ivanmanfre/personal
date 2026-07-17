import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Hash links (e.g. /#film from the pre-call emails): scroll to the target.
    // Retries cover lazy routes rendering late; after the target is found we keep
    // re-anchoring until the document height settles, because sections above it
    // finish laying out after the first scroll and push the target away.
    if (hash) {
      const id = hash.slice(1);
      let tries = 0;
      let lastHeight = 0;
      let stable = 0;
      const attempt = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView();
          const height = document.documentElement.scrollHeight;
          stable = height === lastHeight ? stable + 1 : 0;
          lastHeight = height;
          if (stable < 3 && tries++ < 40) setTimeout(attempt, 250);
        } else if (tries++ < 40) {
          setTimeout(attempt, 150);
        }
      };
      attempt();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
