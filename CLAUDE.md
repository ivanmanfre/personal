# Ivan System Dashboard

## Stack
React 19 + Vite 6 + Tailwind 4 + Supabase (project: bjbvqvzbzczjbatgmccb)

## Architecture
```
Supabase tables ← n8n workflows populate data
     ↓
hooks/use*.ts   ← fetch + derived state + mutation methods
     ↓
Panel components ← consume hooks, render UI
     ↓
dashboardActions.ts ← all writes go through supabase.rpc('dashboard_action')
```

## Data Flow
- **Read**: Hook calls `supabase.from('table').select(...)` → maps snake_case → camelCase via `mapXxx()` function
- **Write**: `dashboardAction(table, id, field, value)` → RPC with allowlist validation (SECURITY DEFINER)
- **Refresh**: `useAutoRefresh(refreshFn, { realtimeTables })` wraps hooks with interval + Supabase realtime subscriptions
- **Global state**: `DashboardContext` provides refreshRate, systemHealth, lastRefreshed

## Key Patterns
- Every hook returns `{ data, loading, refresh, ...mutations }` — panels destructure this
- Mutations use optimistic UI: update local state first, then fire async RPC
- Panels use shared components: `StatCard`, `StatusDot`, `LoadingSkeleton`, `RefreshIndicator`, `EmptyState`
- Auth is client-side SHA-256 hash check against `VITE_DASHBOARD_HASH` env var

## File Map
- `hooks/` — 7 hooks, one per data domain (posts, workflows, leads, competitors, clients, agent, auto-refresh)
- `components/dashboard/` — 8 panels + DashboardLayout + DashboardAuth + shared/
- `types/dashboard.ts` — all interfaces, Tab union type, SystemHealth type
- `lib/dashboardActions.ts` — single RPC helper for all mutations
- `contexts/DashboardContext.tsx` — minimal global state

## Supabase Tables (dashboard reads from)
own_posts, dashboard_workflow_stats, competitor_posts, competitor_patterns, leads,
n8nclaw_proactive_alerts, n8nclaw_reminders, n8nclaw_chat_messages, n8nclaw_daily_summaries,
client_instances (+ client_instances_safe view), client_workflow_errors,
slack_notification_channels

## Naming Conventions
- DB columns: snake_case → hook maps to camelCase interfaces
- Hooks: `use` + domain name (useLeads, useWorkflowStats)
- Panels: `{Domain}Panel.tsx`
- All Tailwind, no CSS files. Dark theme (zinc-900 bg, zinc-800 borders, emerald/blue/amber accents)
