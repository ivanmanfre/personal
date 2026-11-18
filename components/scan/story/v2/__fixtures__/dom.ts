/** jsdom lacks the observers framer-motion and the step nav use; stub them so components mount. */
const g = globalThis as Record<string, unknown>;
class Observer { constructor(_cb?: unknown, _o?: unknown) {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
if (!g.IntersectionObserver) g.IntersectionObserver = Observer;
if (!g.ResizeObserver) g.ResizeObserver = Observer;
if (typeof window !== 'undefined' && !window.matchMedia) window.matchMedia = ((q: string) => ({matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false})) as unknown as typeof window.matchMedia;
if (typeof window !== 'undefined' && !window.scrollTo) window.scrollTo = (() => {}) as typeof window.scrollTo;
