# White-label board host

A client board can also live on the client's own domain, same origin, so email sign-in,
the `#ml=` sign-in link and the `?k=` board link all work there. Today: SwishDM at
**https://madebyswishdm.com/board** (slug `swishdm-live`). The old
`ivanmanfredi.com/client/swishdm-live` and `inboundonsteroids.com/client/swishdm-live`
addresses keep working.

## How a board release reaches the client domain

Automatic: every push to `main` runs the `swishdm-board-mirror` job in
`.github/workflows/deploy.yml`. It runs `scripts/publish-board-host.sh swishdm --push`,
which builds the board-only bundle and pushes it into `ivanmanfre/swishdm-resources`
`site/board/`. That repo's Pages workflow publishes it about a minute later.

By hand (same result):

```
scripts/publish-board-host.sh swishdm          # build + sync into ~/.local/state/board-host-publish/swishdm, no push
scripts/publish-board-host.sh swishdm --push   # build + sync + git push origin main
```

Check: `curl -s https://madebyswishdm.com/board/ | grep board-host-` shows the new asset hash.

## What the build is

- `vite.board-host.config.ts` + `board-host.html` + `board-host.tsx`: only `ClientBoardPage`,
  slug fixed at build time (`lockedSlug`), base `/board/`.
- No `public/` dir, no service worker, no LemonSqueezy, no operator JSON-LD or OG.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` reach the bundle. The publish script
  fails if any JWT other than the anon key, or an `sb_secret_` key, is in the output.
- Head: `noindex, nofollow`, canonical = the client address, client favicon.

## What changes for a white-label slug (any host)

`lib/boardHost.ts` lists white-label slugs. For those boards:

- Team panel share link = the client address.
- No "Operated by InboundOnSteroids", no InboundOnSteroids signature on Strategy, operator
  actions read "Content team", operator sign-ins are left off the visible team list (they
  still work).
- Canonical = the client address.

## Sign-in emails

`supabase/functions/board-magic-link` `HOSTED`: a request from `https://madebyswishdm.com`
gets a link to `https://madebyswishdm.com/board/#ml=...`, sent from
`SwishDM <login@madebyswishdm.com>` with a SwishDM footer (falls back to the house sender if
Resend refuses that sender; the link still points at the client domain). That host can only
request its own slug. Requests from our own domains are unchanged. Deploy with
`supabase functions deploy board-magic-link --project-ref bjbvqvzbzczjbatgmccb --no-verify-jwt`.

Supabase Auth redirect allow-list also carries `https://madebyswishdm.com/board` and
`https://madebyswishdm.com/board/**`.

## Client repo

`ivanmanfre/swishdm-resources` (public, Pages from `site/` via Actions):
`/` and every unknown path redirect to https://swishdm.com/ (noindex `404.html`); stray
`/board/...` paths return to `/board/`. Resource pages go in their own folder under `site/`.

## Adding another client

1. Add the slug to `WHITE_LABEL_BOARDS` (lib/boardHost.ts) and a host to `BOARD_HOSTS`
   (vite.board-host.config.ts).
2. Add the origin to `HOSTED` in board-magic-link (verified Resend sender) and redeploy.
3. Add a `case` to `scripts/publish-board-host.sh` and a job like `swishdm-board-mirror`.
4. Add the address to the Supabase Auth redirect allow-list.
