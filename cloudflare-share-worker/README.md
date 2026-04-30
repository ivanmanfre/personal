# scorecard-share — Cloudflare Worker

Serves the shareable verdict cards for the Agent-Ready Scorecard at `share.ivanmanfredi.com`.

## What it does

Two routes, both keyed on the row UUID:

- `GET https://share.ivanmanfredi.com/scorecard/:id` — returns lightweight HTML with proper OG meta tags + meta-refresh redirect to the SPA at `ivanmanfredi.com/scorecard/result/:id`. This is what LinkedIn / X / Slack scrapers see.
- `GET https://share.ivanmanfredi.com/scorecard/:id/og.png` — returns a 1200×630 PNG of the verdict card, rendered server-side via Satori + resvg-wasm.

The Worker calls the Supabase edge function `scorecard-get` for the row data — no direct DB access, no service role key on the Worker.

## One-time deploy

### 1. Install dependencies

```bash
cd ~/Desktop/personal-site/cloudflare-share-worker
npm install
```

### 2. Authenticate wrangler

```bash
npx wrangler login
```

Opens a browser — log in with the Cloudflare account that owns `ivanmanfredi.com`.

### 3. Deploy the Worker

```bash
npx wrangler deploy
```

This deploys to a `*.workers.dev` subdomain and binds the route `share.ivanmanfredi.com/*` (per `wrangler.toml`).

### 4. DNS — add the subdomain

Cloudflare needs a DNS record routing `share.ivanmanfredi.com` to the Worker.

In the Cloudflare dashboard for `ivanmanfredi.com`:
1. **DNS** → **Add record**
2. Type: `AAAA` · Name: `share` · IPv6 address: `100::` · Proxy: **Proxied (orange cloud)**
3. Save

The Worker's route binding handles the rest.

### 5. Verify

```bash
# Submit a real test scorecard first to get an :id
ID=$(curl -s -X POST https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/scorecard-submit \
  -H 'Content-Type: application/json' \
  -d '{"scores":{"structured_input":5,"decision_logic":4,"narrow_scope":5,"human_loop":4},"verdict":"agent_ready"}' \
  | grep -oE '[0-9a-f-]{36}')
echo "Test row: $ID"

# Check HTML response
curl -i "https://share.ivanmanfredi.com/scorecard/$ID" | head -30

# Check OG image
curl -o /tmp/test-og.png "https://share.ivanmanfredi.com/scorecard/$ID/og.png"
open /tmp/test-og.png
```

LinkedIn-specific check: paste the share URL into a LinkedIn post composer (don't post). The preview card should show the verdict + score in italic serif on sage/cream background.

## Updating the OG card design

`src/worker.tsx` contains the JSX-like layout passed to Satori. To iterate:

1. Edit the layout
2. `npx wrangler dev` for local preview at `http://localhost:8787/scorecard/<id>/og.png`
3. `npx wrangler deploy` when happy

Cache TTL on PNG response is 1 day per `:id`. To bust cache during iteration, append a dummy query string: `og.png?v=2`.

## Architecture notes

- **No service role key on the Worker** — it calls `scorecard-get`, which is the only piece holding service role. Reduces blast radius if the Worker is compromised.
- **Fonts loaded once per cold start** — Space Grotesk (sans), DM Serif Display (italic serif), IBM Plex Mono. Cached in module-global. Cold-start latency: ~400ms first request, ~10ms subsequent.
- **resvg-wasm bundled** — converts Satori's SVG output to PNG. ~800KB Wasm binary. Acceptable for OG image rendering on edge.
- **No analytics on the Worker** — share-count is incremented from the SPA via `scorecard-share` edge function on click, not on scraper preview load.

## Cost

Cloudflare Workers free tier: 100k requests/day. OG image generation counts as one Worker request. At >50 shares/day this stays well within free tier.

## Troubleshooting

- **404 on share URL** — DNS not configured (step 4) or route not bound. Check Cloudflare dashboard → Workers & Pages → scorecard-share → Settings → Domains & Routes.
- **Garbled OG image** — fonts didn't load. Check browser network tab on the og.png URL for what failed. Google Fonts URLs occasionally change; update in `loadFonts()`.
- **LinkedIn preview shows old card** — LinkedIn caches OG images for ~7 days. Force refresh via [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/).
