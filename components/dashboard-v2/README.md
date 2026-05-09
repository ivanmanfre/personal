# Dashboard v2

Control board redesign — 25 tabs collapsed to 8 sections, cool-dark
editorial design system, installable PWA with native push.

## Activation

| URL | Routes to |
|---|---|
| `/dashboard-v2` | v2 directly (always) |
| `/dashboard?v=2` | v2 (URL override) |
| `/dashboard?v=1` | v1 (URL override) |
| `/dashboard` (no override) | v2 if `integration_config.dashboard_v2_enabled=true`, else v1 |

To enable v2 as the default for `/dashboard`:

```sql
UPDATE integration_config SET value='true' WHERE key='dashboard_v2_enabled';
-- or insert if missing:
INSERT INTO integration_config (key, value) VALUES ('dashboard_v2_enabled','true');
```

## Architecture

```
components/dashboard-v2/
├── dashboard-v2.css      Scoped design tokens + primitive styles
├── types.ts              SectionId, NavItem, PaletteItem, Severity
├── Shell.tsx             Sidebar + main + ⌘K palette + URL state
├── Sidebar.tsx           8-section nav with grouped dividers
├── CommandPalette.tsx    ⌘K overlay
├── PwaInstall.tsx        One-shot install prompt chip
├── NotificationSettings.tsx  Personal → Settings push opt-in
├── registerSW.ts         Service worker registration
├── DemoShell.tsx         Entry point (default export)
├── primitives/           15 reusable building blocks
│   ├── KpiTile + KpiRow
│   ├── StatusChip
│   ├── SectionLabel
│   ├── ActionCard + ActionGrid
│   ├── ToggleSwitch + ToggleRow
│   ├── BtnGhost
│   ├── Row + RowList
│   ├── ClientRow
│   ├── Funnel + FunnelSeg
│   ├── Pulse + PulseCell
│   ├── Marginalia
│   ├── ErrBanner
│   ├── Card
│   ├── HeadRow
│   └── SubTabs + SubTab
└── sections/
    ├── Briefing.tsx       Phase 1 — composed live data
    ├── ContentStudio.tsx  Phase 2 — wraps 7 panels
    ├── ReachPipeline.tsx  Phase 3 — wraps 6 panels
    ├── Operations.tsx     Phase 4 — wraps 5 panels
    ├── Clients.tsx        Phase 5 — wraps ClientsPanel
    ├── Knowledge.tsx      Phase 6 — wraps Brain + Prompts
    ├── Agent.tsx          Phase 6 — wraps AgentPanel
    └── Personal.tsx       Phase 6 — wraps Health + Settings + push opts
```

## Hooks added

- `useCommandPaletteV2` — ⌘K state + filtering + keyboard nav
- `usePushSubscription` — VAPID flow, push_subscriptions upsert
- `useDashboardV2Flag` — reads `integration_config.dashboard_v2_enabled`
  with URL `?v=` override

## Principles preserved from INVENTORY.md

Every write path documented in the v1 inventory still flows through the
original panel components. v2 is a chrome change, not a rewrite. Specifically:

- **Drag-to-reschedule timezone math** — ContentPanel keeps its
  `localDateKey` / `toISOFromLocal` helpers verbatim.
- **Optimistic-lock TTL** — OutreachPanel + UpworkPanel internals untouched.
- **Fix-status 6-state machine** — ClientsPanel renders inside Phase 5 wrapper.
- **Three-type drafts queue** (DM / email / connection_note) — OutreachPanel
  preserves separate approve flows.
- **Friendly-error translator** for Apify quota — internal to OutreachPanel.
- **Commenting cohort sub-system** — three queues preserved.
- **All 8 webhooks + 2 edge functions** still fire from their original callers.
- **DashboardAuth password gate** — applies to /dashboard; /dashboard-v2 is
  reachable directly (no separate gate needed; same browser auth applies).

## Phases

| # | Status | What |
|---|---|---|
| 0 | ✓ | Design system + Shell + ⌘K |
| 1 | ✓ | Briefing wired to live data (5 hooks composed) |
| 2 | ✓ | Content Studio (7 sub-tabs wrap legacy panels) |
| 3 | ✓ | Reach & Pipeline (6 sub-tabs) |
| 4 | ✓ | Operations (5 sub-tabs) |
| 5 | ✓ | Clients (single panel) |
| 6 | ✓ | Knowledge / Agent / Personal |
| 7 | ✓ | PWA install + web push (manual setup in `PHASE-7-SETUP.md`) |
| 8 | ✓ | Feature-flag cutover with URL migration |
| 9 | ✓ | Documentation (this file) |

## Future cleanup (not blocking)

- Per-panel restyle to v2 primitives (currently legacy panels keep their
  zinc-dark Tailwind aesthetic inside v2 chrome)
- Live badge counts on sidebar nav (currently only Briefing computes
  badge from data; other sections show no counts in nav)
- Remove pre-existing button-in-button hydration warnings inside
  legacy panels (low priority, not v2-introduced)
- Once v2 is stable for 1+ week, delete `components/dashboard/Dashboard.tsx`
  v1 entry and route `/dashboard` directly to `DemoShell`. Existing `?v=1`
  fallback can be removed at the same time.

## Manual setup checklist (Ivan)

1. Run `npx web-push generate-vapid-keys`, follow `PHASE-7-SETUP.md`
2. Apply `migrations/push_subscriptions.sql` to Supabase
3. Deploy `supabase functions deploy send-push-notification`
4. Add `dashboard_v2_enabled` row to `integration_config` (set to `true`
   when ready to default `/dashboard` to v2)
5. Wire n8n triggers to call the edge function on RED events
   (instructions in PHASE-7-SETUP.md)
