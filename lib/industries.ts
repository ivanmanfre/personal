import type { PreconditionKey } from './preconditions';

export type IndustryKey =
  | 'professional_services'
  | 'agency_consulting'
  | 'financial_services'
  | 'property_real_estate'
  | 'ecommerce_retail'
  | 'solar_energy'
  | 'other';

export interface Industry {
  key: IndustryKey;
  label: string;
  /** Per-precondition weak-spot framing. One short sentence each, written in second person. */
  weakSpot: Record<PreconditionKey, string>;
  /** Single-line "what usually breaks first" framing. Shown when industry is set but no weakest precondition is targeted. */
  default: string;
}

export const INDUSTRIES: Industry[] = [
  {
    key: 'professional_services',
    label: 'Professional services',
    weakSpot: {
      structured_input:
        "Client data lives in inboxes and partner heads. Extraction is where most professional-services AI builds stall.",
      decision_logic:
        "Senior judgment isn't written down, so any agent ends up guessing on the same calls your best advisor makes by reflex.",
      narrow_scope:
        "Trying to automate the whole client lifecycle at once is the most common reason these builds quietly die in month two.",
      repeatability:
        "Every client engagement looks bespoke on paper. The workflows that actually repeat (intake, analysis, deliverable formatting) hide under custom framing.",
    },
    default:
      "In professional services, the build that ships is the one with one workflow scoped, partner judgment encoded, and the work recurring often enough to compound.",
  },
  {
    key: 'agency_consulting',
    label: 'Agency or consulting',
    weakSpot: {
      structured_input:
        "Project data is scattered across Notion, Slack, and 14 client folders. Agents that read inconsistent inputs produce inconsistent outputs.",
      decision_logic:
        "What separates your senior strategists from juniors isn't documented, so any agent you build defaults to the junior version.",
      narrow_scope:
        "Most agency AI plans try to replace a function (research, copy, reporting) all at once and ship none of it. One workflow, end-to-end.",
      repeatability:
        "Each project pitches itself as unique to the client. The templates underneath repeat — but the repeatable parts get buried under custom branding.",
    },
    default:
      "Agencies that ship AI start with one repeatable deliverable, encode the senior strategist's logic, and stick to it long enough to compound.",
  },
  {
    key: 'financial_services',
    label: 'Financial services',
    weakSpot: {
      structured_input:
        "Client data sits across legacy systems and KYC PDFs. The input pipeline is usually where compliance and AI both break.",
      decision_logic:
        "Decisions hinge on advisor judgment that isn't written down, so any agent ends up either over-cautious or off-policy.",
      narrow_scope:
        "Trying to AI-enable the whole advisor workflow before one task works is the most common pattern in failed financial-services pilots.",
      repeatability:
        "Compliance work repeats quarterly, but regulator updates and per-client edge cases can make month-to-month patterns drift more than expected.",
    },
    default:
      "In regulated finance, every agent needs a clean input source, written decision rules, and a workflow that recurs often enough to be worth encoding.",
  },
  {
    key: 'property_real_estate',
    label: 'Property or real estate',
    weakSpot: {
      structured_input:
        "Listing, lease, and buyer data lives in 4 systems plus agent inboxes. Extraction is where every PropTech AI build hits its first wall.",
      decision_logic:
        "Top agents qualify buyers in 30 seconds on instinct. That instinct isn't written down, so agents you build can't do it.",
      narrow_scope:
        "Most failed property AI plans try to handle the whole funnel end-to-end on day one. Start with one stage, in one segment.",
      repeatability:
        "Listing volume looks high, but the workflows that actually repeat (showings, qualifications, contract drafting) are smaller in volume than the busy-work suggests.",
    },
    default:
      "In property, the AI work that survives is scoped to one funnel stage, with the top agent's judgment encoded and a workflow that recurs often enough to compound.",
  },
  {
    key: 'ecommerce_retail',
    label: 'E-commerce or retail',
    weakSpot: {
      structured_input:
        "Product, inventory, and customer data are split across Shopify, WMS, and a marketing stack. AI that can't read them all consistently won't ship.",
      decision_logic:
        "Merchandising and customer-service decisions live in operator heads. Without those rules written, agents make decisions you wouldn't.",
      narrow_scope:
        "Trying to AI-enable support, copy, and merchandising at once is the most common reason e-com AI plans never fully launch.",
      repeatability:
        "Order and support volumes are high, but campaigns and promos shift constantly. Separate the genuinely-repeating workflows (returns, fraud, fulfillment) from the seasonal one-offs.",
    },
    default:
      "In e-com, ship one repeating workflow (return triage, product copy, support tier-1) end-to-end with the merchant's logic encoded before widening.",
  },
  {
    key: 'solar_energy',
    label: 'Solar or energy',
    weakSpot: {
      structured_input:
        "Quoting and survey data sits across CRM, design tools, and installer notes. The input pipeline is usually the first thing to fix.",
      decision_logic:
        "Senior estimators carry pricing and feasibility logic in their heads. Without that documented, agents quote what they shouldn't.",
      narrow_scope:
        "Most solar AI plans try to automate the whole sales-to-install handoff. Start with one stage that actually slows you down today.",
      repeatability:
        "Each install feels bespoke, but permitting, site assessments, and customer comms hit the same patterns site to site. The repeating parts are the targets.",
    },
    default:
      "In solar, the AI build that ships is one stage of the sales-to-install path, with senior estimator logic written down and the workflow recurring often enough to compound.",
  },
  {
    key: 'other',
    label: 'Something else',
    weakSpot: {
      structured_input:
        "Where the data lives, and how consistently the agent can read it, is almost always the first thing to fix before any build.",
      decision_logic:
        "If your best operator can't write down how they decide, the agent you build will guess on the same calls they make by reflex.",
      narrow_scope:
        "The most common pattern in failed AI plans is trying to replace a whole function at once. One workflow, end-to-end, before widening.",
      repeatability:
        "If the workflow you'd most love to automate happens less than weekly, the math probably doesn't work yet. Wait until it's a recurring pain.",
    },
    default:
      "The build that ships is the one with one workflow scoped, decision logic written down, and the work recurring often enough to compound.",
  },
];

export const industryByKey = (key: IndustryKey | null | undefined): Industry => {
  return INDUSTRIES.find((i) => i.key === key) ?? INDUSTRIES[INDUSTRIES.length - 1];
};

/**
 * Pick the line of copy to render under the verdict.
 * If a weakest precondition exists, use the targeted line; otherwise the default.
 */
export function industryFlavorLine(
  industry: IndustryKey | null | undefined,
  weakest: PreconditionKey[]
): string {
  const ind = industryByKey(industry);
  if (weakest.length === 1) return ind.weakSpot[weakest[0]];
  return ind.default;
}
