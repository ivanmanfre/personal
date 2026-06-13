import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { T, DIVIDER, ease, inView, prefersReduced, Label, RevealH2, SageSweep, MagneticCTA } from './editorial';

type Case = {
  id: string;
  client: string;
  anonymized?: boolean;
  industry: string;
  title: string;
  metric: string;
  problem: string;
  solution: string;
  outcome: string;
  images?: string[];
  imageAlts?: string[];
  stack?: string[];
};

const cases: Case[] = [
  {
    id: '01',
    client: 'ProvalTech',
    industry: 'Sales Tech',
    title: "AI call auditing, at 100% coverage.",
    metric: '5% sampled → 100% graded',
    stack: ['Fireflies', 'Airtable', 'n8n', 'Claude'],
    problem: "ProvalTech records every sales call in Fireflies. But with multiple call types and a shared recording account, there was no consistent view of rep performance, no fast escalation path when customer risk appeared, and no way to compare reps fairly across different call shapes.",
    solution: "Built a system that ingests every finished call, evaluates it on service and expertise criteria, calculates a final score that adapts to the call type, emails each participant their own summary and action items, and alerts leadership when real risk surfaces, with the excerpt and recording link attached. Internal and solo calls filter out automatically so reports stay clean. Airtable dashboards surface per-call detail, per-rep scorecards, trends, and an issues board.",
    outcome: "Coverage moved from 5% sampled to 100% of calls, escalation from days to the next morning, and every rep now gets personalized feedback after every customer conversation. Zero additional manual work for the team.",
    images: ['/cases/provaltech.png', '/cases/provaltech-detail.png'],
    imageAlts: ['ProvalTech Call Performance Dashboard showing per-call scores and trends', 'Individual call scorecard with criteria scores and quality assessment'],
  },
  {
    id: '02',
    client: 'Marketing Coach',
    anonymized: true,
    industry: 'Agency Operations',
    title: "A lead magnet system that runs itself after approval.",
    metric: '15 min · idea to launched',
    stack: ['n8n', 'RAG', 'Webflow', 'ConvertKit'],
    problem: "Every lead magnet took days of manual work across disconnected tools: writing the content, building landing and resource pages, configuring the email sequence, wiring the tracking link, formatting the spreadsheet if it was a calculator. Output was capped by how much assembly one person could grind through each week.",
    solution: "One idea submitted in the project tool generates the full package in under 15 minutes: copy drafted in the founder's voice via RAG on his own transcripts and top posts. He reviews and approves once. Everything downstream then builds itself in parallel: live landing and resource pages, the email draft, a geo-routed smart link, the calculator sheet, and the scheduled post with comment monitoring and DM sequences.",
    outcome: "Human review preserved at the one gate that matters (content approval), zero manual asset-building after that. Output is no longer capped by assembly time, it's capped by how many good ideas he has in a week.",
  },
  {
    id: '03',
    client: 'ProSWPPP',
    industry: 'Compliance · 50 states',
    title: "Environmental compliance, no researcher in the loop.",
    metric: 'Multi-FTE → same-day',
    stack: ['n8n', 'EPA ECHO', 'FWS IPaC', 'USDA SSURGO', 'pdf.co'],
    problem: "Every stormwater permit required hours of manual research: MS4 operators, endangered species assessments, soil composition, watershed data, state-specific permit terminology. At scale this would have demanded several full-time researchers, and same-day delivery was impossible.",
    solution: "An end-to-end automation from intake to delivery. A research layer pulls the hard data automatically: EPA ECHO for MS4 detection, FWS IPaC for endangered species (project-centered polygons cut the query area 99.9% vs the county-centroid approach), USDA SSURGO for soil, Census and TIGERweb for watersheds. State-specific document chains route by switch with continueOnFail resilience, and a client-facing audit screen lets the team correct pre-populated data before anything generates.",
    outcome: "Same-day document delivery is now on the table. What would have needed multiple full-time researchers plus document specialists runs end-to-end without manual research, with defensible compliance data and a full audit trail.",
    images: ['/cases/proswppp-swppp.png'],
    imageAlts: ['ProSWPPP n8n workflow canvas with state-routed document generation chains'],
  },
  {
    id: '04',
    client: 'ProSWPPP',
    industry: 'SEO Content Ops',
    title: "Multi-format content, from a single interface.",
    metric: '1 → 3 article formats',
    stack: ['Railway', 'WordPress', 'n8n', 'Gemini'],
    problem: "The SEO content pipeline lived in a single Google Sheet supporting only one article type (keyword spokes, 1,000-1,500 words). Derek wanted to scale across three formats (spokes, state pillars, competitor comparisons), but the existing setup had no concept of article types, no pillar-to-spoke relationships, no production visibility, and no way to see coverage gaps across 50 states.",
    solution: "A dedicated AI Content module inside ProSWPPP's Railway app. A 50-state dashboard color-codes coverage at a glance, bulk operations replace one-at-a-time entry, and WordPress syncs every 5 minutes. Each article routes through a format-specific research and writing branch (1,500w spoke, 3,500w pillar, or comparison table), all converging on one image pipeline that embeds the logo naturally into worker photos via Gemini.",
    outcome: "Three content formats from one interface, Google Sheet dependency eliminated, pillar-to-spoke internal linking automated, comparison articles built from the ground up to be the canonical AI-citation source for 'best SWPPP service' queries.",
    images: ['/cases/proswppp-content-states.png', '/cases/proswppp-content-list.png'],
    imageAlts: ['50-state coverage dashboard showing pillar status color-coded by state', 'AI Content article list with 76 published articles across pillar and spoke types'],
  },
  {
    id: '05',
    client: 'ProSWPPP',
    industry: 'Sales Operations',
    title: "State-aware sales follow-up, zero-touch.",
    metric: 'Manual → zero-touch',
    stack: ['Pipedrive', 'n8n'],
    problem: "The sales team was manually managing post-bid follow-up across four sequence types and three reps, copy-pasting templates and swapping regulatory acronyms per state. Misfires happened. Follow-up slipped. Regulatory terminology varied by rep.",
    solution: "Built a Pipedrive-integrated SDR automation that classifies every lead into the right sequence based on project stage, auto-detects the project state and inserts the correct environmental acronym (TCEQ Texas, GA EPD Georgia, CASQUA California, and so on across all 50 states), rotates sender assignment across the team (or honors manual overrides), and sends every email from the assigned rep's actual inbox so deliverability and reply tracking stay authentic. Sequence progression is automatic: as leads move through stages, old trigger fields clear and new sequences fire. Overlap detection surfaces conflicts as Pipedrive tasks.",
    outcome: "Sales follow-up became zero-touch. Every lead, from the right rep, in the right regulatory language, with zero template confusion.",
    images: ['/cases/proswppp-sdr.png'],
    imageAlts: ['n8n SDR automation workflow with Pipedrive integration and state-routing logic'],
  },
  {
    id: '06',
    client: 'Destino Farms',
    industry: 'Cannabis Distribution',
    title: "A supplier menu that reconciles itself.",
    metric: '15+ hrs/week eliminated',
    stack: ['n8n', 'WhatsApp API', 'Firecrawl', 'Google Sheets'],
    problem: "A cannabis distributor was manually consolidating inventory from multiple suppliers across WhatsApp messages, supplier websites, and Google Sheets. Hours daily of data entry. Pricing errors and stale listings slipped through constantly.",
    solution: "Built an intelligent n8n automation that auto-consolidates inventory from every channel into a single master Google Sheet, standardizes product classifications across inconsistent supplier formats (strain types, flower categories, THC percentages), protects supplier identity through vendor coding and automated COA redaction, maintains data integrity with automatic out-of-stock tracking and duplicate management, and mirrors supplier images and documents to the client's own Google Drive so nothing depends on external hosting.",
    outcome: "15+ hours a week of manual work eliminated. Inventory refreshes every 60-120 minutes. Zero supplier information leakage to end clients. Consistent pricing rules apply automatically. The team focuses on sales instead of spreadsheet reconciliation.",
  },
  {
    id: '07',
    client: 'easyGapps',
    industry: 'Cloud Reseller',
    title: "Month-end billing, down to hours.",
    metric: 'Days → hours',
    stack: ['BigQuery', 'Xero', 'n8n'],
    problem: "A Google Workspace reseller was running month-end billing through manual spreadsheet calculations. Errors compounded, margins drifted inconsistent, and tax allocation from Google's aggregated exports, where voice taxes arrived without customer attribution, was a particular reconciliation nightmare.",
    solution: "Built a cloud-native billing automation handling the complete flow from raw usage data to verified invoices in Xero. Daily billing exports ingest into BigQuery. Subscriptions classify automatically as New, Renewal, or Transfer using customer history and heuristic logic. A three-tier pricing engine applies dynamic markup rules with support for customer and SKU-specific overrides. Aggregated voice taxes distribute proportionally based on usage, solving the attribution problem that previously required hours of manual mapping. A dry-run mode lets the team simulate a full billing cycle without touching the live ledger.",
    outcome: "Monthly close time went from days to hours. The tax allocation problem that had driven weeks of reconciliation effort is fully solved. Every invoice is traceable from raw Google Channel data to final customer bill.",
    images: ['/cases/easygapps-billing.png', '/cases/easygapps.png'],
    imageAlts: ['easyGapps Partner Sales Console showing billing accounts', 'Generated invoice in Xero with Google Workspace line items and automated tax allocation'],
  },
  {
    id: '08',
    client: 'Effektify',
    industry: 'Marketing Agency · Norway',
    title: "Every lead, routed in minutes.",
    metric: 'Hours → minutes',
    stack: ['n8n', 'Pipedrive', 'Airtable', 'Slack'],
    problem: "A Norwegian marketing agency was collecting leads from SEOptimer, Typeform, Facebook Ads, Google Ads, and LinkedIn with no unified system. Leads slipped through, response times suffered, and sales reps had no visibility into whether a contact had engaged before.",
    solution: "Built a lead management automation that centralizes every source through a single webhook endpoint and normalizes the data regardless of origin. Every lead backs up to Airtable before any processing, so nothing is ever lost. Deduplication checks both email and domain against existing Pipedrive contacts. Returning leads route to their original sales rep with full context on how they re-entered; new leads distribute round-robin across the team with persistent tracking that survives system restarts. Slack fires instantly with complete context and a direct Pipedrive link.",
    outcome: "The sales team responds in minutes instead of hours. Duplicate outreach is gone. Marketing has full source attribution for ROI analysis, down to the ad platform.",
  },
  {
    id: '09',
    client: 'Digital Agency',
    anonymized: true,
    industry: 'Marketing · Two Founders',
    title: "Two voices, one content engine.",
    metric: '2 founders · daily output',
    stack: ['n8n', 'RAG', 'Apollo', 'ConvertKit'],
    problem: "Two agency founders both needed a consistent LinkedIn presence plus lead magnets, and they write nothing alike. Manual production meant output was capped by whoever had a free evening, and ghostwritten drafts kept flattening both of them into the same generic voice.",
    solution: "A dual-author engine on a three-layer voice architecture: shared brand, a calibrated voice per founder, and a forbidden-language layer that strips the patterns that read as AI. An editorial agent reviews every draft before a human sees it. The lead magnet pipeline ships complete packages from one idea (content, live pages, email), captured leads enrich through Apollo into the newsletter, and weekly research keeps the queue full.",
    outcome: "Both founders publish consistently in their own registers from one pipeline. Lead magnets ship as finished packages instead of week-long assembly projects. Running in production for months, maintained, still shipping.",
  },
  {
    id: '10',
    client: 'Consulting Firm',
    anonymized: true,
    industry: 'Client Onboarding',
    title: "Deal won. Onboarding fires itself.",
    metric: 'Closed → set up, same hour',
    stack: ['n8n', 'DocuSign', 'ClickUp'],
    problem: "Every closed deal kicked off the same manual scramble: create the folders, prepare the documents, send the e-signature, set up the project workspace. Steps slipped exactly when the team was busiest, which is exactly when deals close.",
    solution: "Built a two-stage automation off the deal-won trigger. Stage one assembles everything for review: workspace structure, documents, e-signature packet, project tasks. Stage two executes the onboarding once a human approves, so nothing client-facing ever sends unreviewed. The team's feedback from the first weeks of live use was folded back into the flow.",
    outcome: "Onboarding starts the same hour the deal closes, every step in the same order every time, with the review gate keeping a human in front of anything the client sees.",
  },
];

const WorkPage: React.FC = () => {
  useMetadata({
    title: 'Work | Iván Manfredi',
    description: 'Selected Agent-Ready Ops case studies. AI call auditing, lead magnet systems, compliance automation, content operations, sales follow-up, inventory management, reseller billing.',
    canonical: 'https://ivanmanfredi.com/work',
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-paper)' }}>

      {/* HEADER */}
      <section className="pt-36 pb-14 md:pb-20 border-b px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView}>
            <Label>Work</Label>
            <RevealH2 style={{ ...T.display('clamp(2.6rem,5.2vw,4.6rem)'), marginBottom: '1.5rem', maxWidth: '16ch' }}>
              Systems that{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                shipped.
                <SageSweep delay={0.5} opacity={0.85} />
              </span>
            </RevealH2>
            <p style={{ ...T.serif, fontSize: '19px', maxWidth: '52ch' }}>
              Selected engagements. Each one shipped the same way: fixed scope agreed up front, built inside the client's stack, production-hardened with monitoring and review loops, owned by them at the end.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CASES */}
      <section className="px-8">
        <div className="container mx-auto max-w-6xl">
          {cases.map((c, i) => (
            <motion.article
              key={c.id}
              id={`case-${c.id}`}
              initial={prefersReduced ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.6, ease }}
              className="grid md:grid-cols-12 gap-8 md:gap-12 py-16 md:py-20 border-t first:border-t-0 scroll-mt-32"
              style={DIVIDER}
            >
              {/* Meta column */}
              <div className="md:col-span-4">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span style={{ ...T.mono, marginBottom: 0 }}>{c.id}</span>
                  <span style={{ ...T.mono, marginBottom: 0, color: '#1A1A1A', border: '1px solid rgba(26,26,26,0.25)', padding: '3px 8px' }}>
                    {c.client}
                  </span>
                </div>
                <p style={{ ...T.mono, marginBottom: 0 }}>{c.industry}</p>

                {/* Numeral lockup */}
                <div className="mt-8 pt-6 border-t" style={DIVIDER}>
                  <div style={{ ...T.mono, marginBottom: '8px' }}>Outcome</div>
                  <div style={{ ...T.display('clamp(1.7rem,2.4vw,2.4rem)'), color: 'var(--color-accent)', lineHeight: 1.05 }}>
                    {c.metric}
                  </div>
                </div>

                {/* Stack — receipts that fill the meta column */}
                {c.stack && (
                  <div className="mt-8 pt-6 border-t" style={DIVIDER}>
                    <div style={{ ...T.mono, marginBottom: '12px' }}>Built with</div>
                    <ul className="flex flex-col gap-2.5">
                      {c.stack.map((t) => (
                        <li key={t} className="flex items-center gap-3">
                          <span aria-hidden style={{ width: 5, height: 5, backgroundColor: 'var(--color-accent)', flexShrink: 0 }} />
                          <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#3D3D3B', letterSpacing: '0.02em' }}>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.anonymized && (
                  <p style={{ ...T.mono, marginTop: '1.5rem', textTransform: 'none', letterSpacing: '0.04em' }}>
                    Client name withheld at their request.
                  </p>
                )}
              </div>

              {/* Content column */}
              <div className="md:col-span-8">
                <h2 style={{ ...T.display('clamp(1.9rem,3vw,2.7rem)'), lineHeight: 1.1, marginBottom: '1.5rem' }}>
                  {c.title}
                </h2>

                {c.images && c.images.length > 0 && (
                  <div className={`mb-8 ${c.images.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}`}>
                    {c.images.map((src, idx) => (
                      <div key={idx} className="border overflow-hidden" style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: 'var(--color-paper-sunk)' }}>
                        <img src={src} alt={c.imageAlts?.[idx] ?? ''} loading="lazy" className="w-full h-auto" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-5">
                  {([['The problem', c.problem], ['What shipped', c.solution], ['The result', c.outcome]] as const).map(([lbl, body]) => (
                    <div key={lbl}>
                      <div style={{ ...T.mono, marginBottom: '6px' }}>{lbl}</div>
                      <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '17px', lineHeight: 1.65, color: '#3D3D3B' }}>{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* FINAL CTA — dark band */}
      <section className="border-t" style={{ borderColor: 'rgba(247,244,239,0.12)', backgroundColor: '#1A1A1A' }}>
        <div className="container mx-auto max-w-6xl px-8 py-20 md:py-28 text-center">
          <motion.div {...inView}>
            <Label dark>Your turn</Label>
            <h2 style={{ ...T.display('clamp(2.2rem,4vw,3.6rem)'), color: '#F7F4EF', marginBottom: '1.25rem' }}>
              Have a system you need{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                shipped like this?
                <SageSweep delay={0.45} opacity={0.9} />
              </span>
            </h2>
            <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '17px', color: 'rgba(247,244,239,0.66)', maxWidth: '42ch', margin: '0 auto 2rem', lineHeight: 1.6 }}>
              30 minutes, free. We figure out what to build first and what it costs. If the answer is "nothing yet," I'll tell you that too.
            </p>
            <MagneticCTA href="/start" dark fontSize="17px" px="px-9 py-4">
              Book the fit call <ArrowRight size={18} />
            </MagneticCTA>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default WorkPage;
