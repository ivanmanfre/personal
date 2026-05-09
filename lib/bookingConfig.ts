// Single source of truth for landing-page booking signals.
// Used by both LandingHero (status strip) and LandingPage (FinalCTA line).
// Update OPEN_SLOTS here if availability changes — both surfaces stay in sync.

export const OPEN_SLOTS = 2;

// Auto-rolling booking quarter — always next calendar quarter.
export const getBookingQuarter = (): string => {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3) + 1;
  const nextQ = currentQ === 4 ? 1 : currentQ + 1;
  const year = currentQ === 4 ? now.getFullYear() + 1 : now.getFullYear();
  return `Q${nextQ} ${year}`;
};
