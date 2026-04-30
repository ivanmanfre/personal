/** @jsx h */
/** @jsxFrag Fragment */
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

// Cloudflare Workers runtime types
interface Env {
  SUPABASE_URL: string;
  SITE_URL: string;
}

interface ScorecardResult {
  id: string;
  scores: Record<string, number>;
  total: number;
  verdict: 'agent_ready' | 'close' | 'foundation';
  weakest_keys: string[];
  share_count: number;
}

// Lightweight JSX runtime (Satori parses the React-like tree)
function h(type: string, props: any, ...children: any[]): any {
  return { type, props: { ...props, children: children.flat().filter(Boolean) } };
}
function Fragment(props: any) {
  return props.children;
}

const VERDICT_LABELS: Record<ScorecardResult['verdict'], string> = {
  agent_ready: 'Agent-Ready',
  close: 'Close',
  foundation: 'Foundation first',
};

// Cache fonts in a Worker-global to avoid refetching on every request
let fontsCache: { sans: ArrayBuffer; serif: ArrayBuffer; mono: ArrayBuffer } | null = null;
let resvgInitialized = false;

async function ensureWasm() {
  if (!resvgInitialized) {
    await initWasm(resvgWasm);
    resvgInitialized = true;
  }
}

async function loadFonts() {
  if (fontsCache) return fontsCache;
  const [sans, serif, mono] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPb12ICwOoqr1.woff2')
      .then((r) => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/dmserifdisplay/v15/-nFhOHM81r4j6k0gjAW3mujVU2B2K_d709jy92k.woff2')
      .then((r) => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n5igg1l9kn-s.woff2')
      .then((r) => r.arrayBuffer()),
  ]);
  fontsCache = { sans, serif, mono };
  return fontsCache;
}

async function fetchResult(env: Env, id: string): Promise<ScorecardResult | null> {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/scorecard-get?id=${id}`);
  if (!res.ok) return null;
  return (await res.json()) as ScorecardResult;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderShareHtml(env: Env, result: ScorecardResult, requestUrl: string): string {
  const verdictLabel = VERDICT_LABELS[result.verdict];
  const ogImage = `${requestUrl}/og.png`;
  const title = `Agent-Ready Score: ${verdictLabel} (${result.total}/20)`;
  const description = `A 60-second self-check against the four preconditions every AI deployment needs before it ships.`;
  const targetUrl = `${env.SITE_URL}/scorecard/result/${result.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${targetUrl}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:site_name" content="Iván Manfredi" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <meta http-equiv="refresh" content="0; url=${targetUrl}" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F7F4EF; color: #1A1A1A; margin: 0; padding: 48px; }
    .wrap { max-width: 540px; margin: 0 auto; }
    a { color: #4C6E3D; }
    .verdict { font-family: Georgia, serif; font-style: italic; font-size: 56px; line-height: 1; margin: 24px 0 8px; }
    .score { font-family: Georgia, serif; font-style: italic; font-size: 96px; color: #4C6E3D; line-height: 1; margin: 16px 0; }
    .label { font-family: 'Courier New', monospace; text-transform: uppercase; font-size: 11px; letter-spacing: 0.18em; color: #888; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="label">Agent-Ready Scorecard</p>
    <p class="verdict">${escapeHtml(verdictLabel)}</p>
    <p class="score">${result.total}<span style="font-size:20px;color:#888;font-style:normal;font-family:'Courier New',monospace;letter-spacing:0.18em;text-transform:uppercase;margin-left:8px;">of 20</span></p>
    <p>Redirecting to <a href="${targetUrl}">${targetUrl}</a>…</p>
  </div>
  <script>setTimeout(function(){ window.location.replace(${JSON.stringify(targetUrl)}); }, 100);</script>
</body>
</html>`;
}

async function renderOgPng(result: ScorecardResult): Promise<Uint8Array> {
  await ensureWasm();
  const fonts = await loadFonts();
  const verdictLabel = VERDICT_LABELS[result.verdict];

  // Build the OG card layout — sage/cream brand, italic-serif verdict + score
  const tree = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        background: '#F7F4EF',
        padding: '64px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Space Grotesk',
        color: '#1A1A1A',
      },
    },
    // Top eyebrow + portrait row
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'span',
        {
          style: {
            fontFamily: 'IBM Plex Mono',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '3.5px',
            color: '#888',
          },
        },
        'Agent-Ready Scorecard'
      ),
      h(
        'span',
        {
          style: {
            fontFamily: 'DM Serif Display',
            fontStyle: 'italic',
            fontSize: '36px',
            color: '#1A1A1A',
          },
        },
        'Manfredi'
      )
    ),
    // Center: verdict + score side by side
    h(
      'div',
      { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flex: '1', marginTop: '60px' } },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h(
          'span',
          {
            style: {
              fontFamily: 'IBM Plex Mono',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              color: '#888',
              marginBottom: '12px',
            },
          },
          'Verdict'
        ),
        h(
          'span',
          {
            style: {
              fontFamily: 'DM Serif Display',
              fontStyle: 'italic',
              fontSize: '120px',
              lineHeight: '0.95',
              color: '#1A1A1A',
              maxWidth: '720px',
            },
          },
          verdictLabel
        )
      ),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'baseline', gap: '20px' } },
        h(
          'span',
          {
            style: {
              fontFamily: 'DM Serif Display',
              fontStyle: 'italic',
              fontSize: '240px',
              lineHeight: '0.85',
              color: '#4C6E3D',
            },
          },
          String(result.total)
        ),
        h(
          'span',
          {
            style: {
              fontFamily: 'IBM Plex Mono',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              color: '#888',
              paddingBottom: '16px',
            },
          },
          'of 20'
        )
      )
    ),
    // Bottom hairline + url
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '24px',
          borderTop: '1px solid rgba(26,26,26,0.15)',
        },
      },
      h(
        'span',
        {
          style: {
            fontFamily: 'IBM Plex Mono',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '2.5px',
            color: '#666',
          },
        },
        'ivanmanfredi.com/scorecard'
      ),
      h(
        'span',
        {
          style: {
            fontFamily: 'IBM Plex Mono',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '2.5px',
            color: '#666',
          },
        },
        'Are you Agent-Ready?'
      )
    )
  );

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Space Grotesk', data: fonts.sans, weight: 500, style: 'normal' },
      { name: 'DM Serif Display', data: fonts.serif, weight: 400, style: 'italic' },
      { name: 'IBM Plex Mono', data: fonts.mono, weight: 500, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Match /scorecard/:id and /scorecard/:id/og.png
    const match = path.match(/^\/scorecard\/([0-9a-f-]{36})(\/og\.png)?\/?$/i);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const id = match[1];
    const wantsImage = !!match[2];

    const result = await fetchResult(env, id);
    if (!result) {
      return new Response('Result not found', { status: 404 });
    }

    if (wantsImage) {
      try {
        const png = await renderOgPng(result);
        return new Response(png, {
          headers: {
            'Content-Type': 'image/png',
            // Cache for 1 day; key by id (URL is stable per id)
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      } catch (err) {
        console.error('OG render failed', err);
        return new Response('Render failed', { status: 500 });
      }
    }

    // HTML with OG meta + meta-refresh redirect
    const requestUrl = `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
    const html = renderShareHtml(env, result, requestUrl);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  },
};
