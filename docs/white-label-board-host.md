# Client board hosting

The three live boards run on the standalone board app (`board-app/`). Every other
`/client/<slug>` (preview and demo boards) keeps the classic board (`components/ClientBoardPage.tsx`
in the main SPA), unchanged.

| Board | Slug | Address we hand out | Old addresses |
|---|---|---|---|
| ARCH (Davorin) | `arch-agency` | https://madebyarch.com/board | `ivanmanfredi.com/client/arch-agency`, `inboundonsteroids.com/client/arch-agency` forward there |
| SwishDM (Jonathan) | `swishdm-live` | https://madebyswishdm.com/board | `ivanmanfredi.com/client/swishdm-live`, `inboundonsteroids.com/client/swishdm-live` forward there |
| RISE DTC (Mattan) | `risedtc-com` | https://inboundonsteroids.com/client/risedtc-com | `ivanmanfredi.com/client/risedtc-com` also serves the new board |

The forwards are static pages (`location.replace` plus a noscript refresh) that keep the board
link (`?k=`) and the sign-in link (`#ml=`) exactly. Every board address also has the classic board
one level down, which is where the new board's "classic" link goes:

- `<address>/classic/?k=...`: `/board/classic/` on the client domains (real files),
  `/client/<slug>/classic` on ivanmanfredi.com and inboundonsteroids.com (the SPA via 404.html, for
  every slug including ARCH and SwishDM).

## board-app/

A vendored copy of `~/Desktop/board-next` (Vite 8 + React 19 + Tailwind v4, own `package.json`
and lockfile). Its CSS clashes with the main site's global styles, so it is always its own build,
never part of the main bundle. The root build, `tsconfig.json`, `vitest.config.ts`, the dev dep scan
(`vite.config.ts` `optimizeDeps.entries`) and Tailwind (`styles.css` `@source not`) all ignore it.

Re-sync after board-next changes, then commit:

```
scripts/sync-board-app.sh            # rsync --delete from ~/Desktop/board-next, no .env*, node_modules, dist, .git
```

`board-next/.env.local` holds full-power board tokens; the sync never copies it and refuses if an
env file or a live board token turns up in the copy.

Build contract: env `BOARD_BASE` (vite base), optional `VITE_BOARD_LOCKED_SLUG`, plus
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `npm ci --legacy-peer-deps && npm run build` gives
`dist/`. Without a locked slug the app reads the slug from the address (segment after `client`,
else the first segment). Node `^20.19 || >=22.12` (Vite 8).

## Builds

`scripts/build-board-app.sh <target>`:

| Target | Used by | Output |
|---|---|---|
| `main [dist]` | deploy.yml `build`, after `npm run build:prerender` | `dist/board-app/` (base `/board-app/`), `dist/client/risedtc-com/index.html` = new board, `dist/client/{arch-agency,swishdm-live}/index.html` = forwards. Runs after the prerender, so it wins for those three slugs. |
| `mirror [dist]` | deploy.yml `client-mirror` (dist is rsynced 1:1 into inboundonsteroids-site `client/`) | `dist/board-app/` (base `/client/board-app/`), `dist/risedtc-com/index.html`, `dist/{arch-agency,swishdm-live}/index.html` forwards. `/client/<slug>/classic` reaches `client/index.html` through that site's root 404.html. |
| `host <swishdm\|arch> [out]` | `scripts/publish-board-host.sh` | `out/` = board-app, base `/board/`, slug locked; `out/classic/` = the classic board-host bundle (`vite.board-host.config.ts`, base `/board/classic/`). |

Every build runs under `env -i` with only the two public Supabase values, and every output goes
through `scripts/board-secret-guard.mjs`: it fails on an `sb_secret_` key, any JWT whose role is
not `anon`, any of the three live board tokens (matched by SHA-256; this repo is public), an env
file, or a file name starting with `_` or `.` (madebyarch.com is a Jekyll build and drops those).
Board pages always carry `noindex, nofollow`.

## How a release reaches each address

Automatic on every push to `main` (`.github/workflows/deploy.yml`):

- `build`: ivanmanfredi.com (Pages artifact).
- `client-mirror`: inboundonsteroids.com/client/ (pushed into `ivanmanfre/inboundonsteroids-site`).
- `swishdm-board-mirror`: `scripts/publish-board-host.sh swishdm --push` into
  `ivanmanfre/swishdm-resources` `site/board/` (that repo's Pages workflow deploys).
- `arch-board-mirror`: `scripts/publish-board-host.sh arch --push` into `ivanmanfre/madebyarch`
  `board/` (legacy branch Pages build from the repo root). `MIRROR_PUSH_TOKEN` needs write access
  to that repo.

By hand (same result):

```
scripts/publish-board-host.sh arch          # build + sync into ~/.local/state/board-host-publish/arch, no push
scripts/publish-board-host.sh arch --push   # build + sync + git push origin main
```

The publish clone is sparse and blobless (madebyarch is over 1 GB of audit pages): only the board
folder, `.board-releases/` and root files are checked out. The sync keeps the last two releases'
hashed assets per folder (`assets/` and `classic/assets/`, ledgers `.board-releases/<host>` and
`.board-releases/<host>-classic`) because Pages caches index.html for about 10 minutes.

Check: `curl -s https://madebyarch.com/board/ | grep assets/` and
`curl -s https://madebyarch.com/board/classic/ | grep board-host-` show the new hashes.

## What changes for a white-label slug

`lib/boardHost.ts` `WHITE_LABEL_BOARDS` (`swishdm-live`, `arch-agency`). On the classic board for
those slugs: the team panel share link and the canonical are the client address; no "Operated by
InboundOnSteroids", no InboundOnSteroids signature on Strategy, operator actions read "Content
team", operator sign-ins are left off the visible team list (they still work).

## Sign-in emails

`supabase/functions/board-magic-link` `HOSTED`: a request from `https://madebyswishdm.com` or
`https://madebyarch.com` gets a link to `<host>/board/#ml=...`, sent from
`SwishDM <login@madebyswishdm.com>` / `ARCH <login@madebyarch.com>` with that brand in the footer
(falls back to the house sender if Resend refuses the client sender; the link still points at the
client domain). A host can only request its own slug. Requests from our own domains still link to
`inboundonsteroids.com/client/<slug>#ml=...`, which forwards with the hash for ARCH and SwishDM.
Deploy with
`supabase functions deploy board-magic-link --project-ref bjbvqvzbzczjbatgmccb --no-verify-jwt`.

Supabase Auth redirect allow-list carries `https://madebyswishdm.com/board` and
`https://madebyswishdm.com/board/**`; ARCH needs `https://madebyarch.com/board` and
`https://madebyarch.com/board/**`.

## Client repos

- `ivanmanfre/swishdm-resources` (public, Pages from `site/` via Actions): `/` and every unknown
  path redirect to https://swishdm.com/ (noindex `site/404.html`); stray `/board/...` paths return
  to `/board/`. Resource pages go in their own folder under `site/`.
- `ivanmanfre/madebyarch` (public, legacy Pages build from `main` root, no `.nojekyll`, CNAME
  madebyarch.com): ARCH lead-magnet and audit pages in their own folders (written by other
  automation, often). The board lives in `board/`. The site had no custom 404; the first publish
  seeds a root `404.html` (never overwritten) that sends stray `/board/...` paths back to
  `/board/` with `?k=` and `#ml=`, and shows a plain noindex ARCH not-found page for anything else.

## Adding another client

1. Add the slug to `WHITE_LABEL_BOARDS` (lib/boardHost.ts) and a host to `BOARD_HOSTS`
   (vite.board-host.config.ts).
2. Add the slug to `FORWARD_SLUGS` + `forward_url` and the host to the `host` case in
   `scripts/build-board-app.sh`.
3. Add the origin to `HOSTED` in board-magic-link (verified Resend sender) and redeploy.
4. Add a `case` to `scripts/publish-board-host.sh` and a job like `arch-board-mirror`.
5. Add the address to the Supabase Auth redirect allow-list.
