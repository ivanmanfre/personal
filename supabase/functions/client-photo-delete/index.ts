// Deploy only after 20261016_board_activity_and_storage_receipts.sql:
// supabase functions deploy client-photo-delete --no-verify-jwt --project-ref bjbvqvzbzczjbatgmccb
// Auth and durable intent/completion records are enforced by board_photo_operation.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleDelete } from './handler.ts';
Deno.serve((req) => {
  const api = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  return handleDelete(req, { rpc: (name, args) => api.rpc(name, args), remove: (path) => api.storage.from('client-photos').remove([path]) });
});
