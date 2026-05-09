// send-push-notification — fans out a payload to every active push_subscriptions row.
// Called by:
//   - n8n on RED dispatches (failed posts, high-severity errors, etc.)
//   - dashboard "Send test" button
//
// Required Supabase secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:ivan@…)
//
// Payload (JSON body):
//   { title: string, body: string, severity?: 'good'|'warn'|'bad', deeplink?: string }

// @ts-ignore — Deno runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';
// Deno-compatible web-push library
// @ts-ignore
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// @ts-ignore — Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // @ts-ignore
    const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // @ts-ignore
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    // @ts-ignore
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    // @ts-ignore
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:ivan@ivanmanfredi.com';

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const payload = await req.json().catch(() => ({}));
    if (!payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: 'title + body required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const supabase = createClient(SUPA_URL, SUPA_KEY);
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth');
    if (error) throw error;

    const results = await Promise.allSettled(
      (subs || []).map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            severity: payload.severity || 'warn',
            deeplink: payload.deeplink || '/dashboard-v2',
          })
        ).catch((e: any) => {
          // 410 Gone / 404 Not Found = subscription expired, prune it
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            return supabase.from('push_subscriptions').delete().eq('id', s.id);
          }
          throw e;
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ ok: true, sent, failed, total: subs?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
