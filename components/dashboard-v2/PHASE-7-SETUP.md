# Phase 7 — PWA + Push Notifications: Manual Setup

The code is shipped. Three things require your hands:

## 1. Generate VAPID keys (one-time)

```bash
cd ~/Desktop/personal-site
npx web-push generate-vapid-keys
```

You'll get a public + private key. Then:

```bash
# Add public key to .env (committed via deploy)
echo "VITE_VAPID_PUBLIC_KEY=<paste public>" >> .env

# Store private key + subject as Supabase secrets
supabase secrets set VAPID_PUBLIC_KEY="<public>"
supabase secrets set VAPID_PRIVATE_KEY="<private>"
supabase secrets set VAPID_SUBJECT="mailto:ivan@ivanmanfredi.com"
```

## 2. Apply the migration

```sql
-- Run this against the Ivan Supabase project (bjbvqvzbzczjbatgmccb)
-- File: migrations/push_subscriptions.sql
```

Apply via Supabase dashboard SQL editor, or:

```bash
supabase db push
```

## 3. Deploy the edge function

```bash
supabase functions deploy send-push-notification
```

Verify: `curl -X POST https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer <anon-or-service-key>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Hello from edge","severity":"good"}'`

## 4. Wire n8n triggers (optional, do this when ready to start receiving)

Trigger the edge function from n8n on these events:

| Event | Where in n8n |
|---|---|
| Failed `scheduled_posts` row inserted | Add a Supabase trigger node post-publish |
| New `client_workflow_errors` with severity=high | Already runs Client Health Monitor — append HTTP step |
| Prospect transitions to `needs_manual_reply=true` | Outreach Conversation Monitor workflow |
| `n8nclaw_proactive_alerts` queue length > 10 | Daily Standup workflow check |

HTTP node config:
```
Method: POST
URL: https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/send-push-notification
Headers:
  Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
  Content-Type: application/json
Body:
  {
    "title": "Post failed to publish",
    "body": "{{ $json.post_text | slice(0, 80) }}",
    "severity": "bad",
    "deeplink": "/dashboard-v2?section=content&sub=pipeline"
  }
```

## 5. Test the flow

1. Visit https://ivanmanfredi.com/dashboard-v2 (or localhost:3000)
2. Personal → Settings → Enable push (browser will prompt for permission)
3. Click "Send test" — native macOS notification should fire
4. Click the notification — should open the deeplink

## Browser support

- ✅ Chrome / Edge / Brave (all platforms)
- ✅ Safari 16.4+ on macOS Ventura+ (requires the dashboard installed as PWA)
- ❌ Firefox on iOS (no web push at all)

For best macOS experience: install as PWA first (the Install prompt appears
once on dashboard-v2 visit). Notifications then appear in the macOS
Notification Center even when the browser is closed.
