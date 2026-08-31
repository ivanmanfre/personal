-- Draft provenance backfill (2026-08-31).
-- Ivan on the panel: "i cant see when the topic was sourced and from where exactly.. what
-- sales call? date". The panel already renders carousel_drafts.source_detail (call title +
-- verbatim quote, plumbed by the queue sync) — but the drafter never stamps it, so most
-- rows sat at null and fell back to the vague source_label. This function reconstructs it:
--   * every null-source_detail review/scheduled draft with a linked client_ideas row gets
--     at least {kind, label, sourced_at} (when the topic entered the idea bank);
--   * call-sourced ideas carry the verbatim quote (score_breakdown->>'why');
--   * the quote's first 30 chars (lowercased, curly quotes normalized) are matched against
--     call_reports.report_json and transcripts.transcript_text to recover WHICH call —
--     report titles ("David Sanborn - Kiid Coffee") win over raw transcript titles on a tie.
-- Matching is prefix-on-verbatim: rationale-style 'why' texts simply never match, which is
-- correct (no invented provenance). meeting_date <= idea created_at guards against a
-- later call that happens to contain the same phrase.
-- Runs every 2h via pg_cron; fires the board queue-sync webhook per affected client so the
-- cached blob picks the fields up (board_visible trap: blob is a cached JSONB).
-- APPLIED to bjbvqvzbzczjbatgmccb via the Management API on 2026-08-31; this file is the record.

CREATE OR REPLACE FUNCTION public.backfill_draft_provenance()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_n integer; v_client text;
begin
  create temp table _prov_touched (client_id text) on commit drop;

  with cand as (
    select cd.id as draft_id, cd.client_id, ci.source_label, ci.created_at as idea_at,
           ci.score_breakdown->>'why' as why,
           lower(translate(split_part(coalesce(ci.score_breakdown->>'why',''), '"', 1),
                           chr(8217)||chr(8216), chr(39)||chr(39))) as w
    from carousel_drafts cd
    join client_ideas ci on ci.id = cd.client_idea_id
    where cd.source_detail is null and cd.status in ('review','scheduled')
  ),
  matched as (
    select c.*, m.mt, m.md
    from cand c
    left join lateral (
      select u.mt, u.md from (
        select r.meeting_title as mt, r.meeting_date as md, 0 as rk
        from call_reports r
        where length(c.w) >= 30 and r.meeting_date <= c.idea_at
          and strpos(lower(translate(r.report_json::text, chr(8217)||chr(8216), chr(39)||chr(39))), left(c.w, 30)) > 0
        union all
        select t.title, t.date, 1
        from transcripts t
        where length(c.w) >= 30 and t.date <= c.idea_at
          and strpos(lower(translate(t.transcript_text, chr(8217)||chr(8216), chr(39)||chr(39))), left(c.w, 30)) > 0
      ) u order by u.md desc, u.rk asc limit 1
    ) m on true
  ),
  upd as (
    update carousel_drafts cd
    set source_detail = case
        when m.mt is not null then jsonb_build_object(
          'kind','call','label','From your sales calls',
          'call_title', m.mt, 'call_date', to_char(m.md, 'YYYY-MM-DD'),
          'quote', case when length(m.why) > 280 then regexp_replace(left(m.why, 280), '\s+\S*$', '') || chr(8230) else m.why end,
          'sourced_at', to_char(m.idea_at, 'YYYY-MM-DD'),
          'matched','quote')
        when m.source_label = 'From your sales calls' and m.why is not null then jsonb_build_object(
          'kind','call','label','From your sales calls',
          'quote', case when length(m.why) > 280 then regexp_replace(left(m.why, 280), '\s+\S*$', '') || chr(8230) else m.why end,
          'sourced_at', to_char(m.idea_at, 'YYYY-MM-DD'))
        else jsonb_build_object(
          'kind','idea','label', coalesce(m.source_label, 'Planned topic'),
          'sourced_at', to_char(m.idea_at, 'YYYY-MM-DD'))
      end,
      updated_at = now()
    from matched m
    where cd.id = m.draft_id
    returning cd.client_id
  )
  insert into _prov_touched select client_id from upd;

  select count(*) into v_n from _prov_touched;
  delete from _prov_touched where client_id is null;
  -- Refresh each touched board's cached blob (the sync webhook is the ONLY thing that
  -- surfaces a carousel_drafts change on the panel).
  for v_client in select distinct client_id from _prov_touched loop
    perform net.http_post(
      url := 'https://n8n.ivanmanfredi.com/webhook/client-board-queue-sync?k=6098d6f092c50f5f1894fd61',
      body := jsonb_build_object('client_id', v_client),
      headers := '{"Content-Type":"application/json"}'::jsonb);
  end loop;
  return v_n;
end $function$;

-- Every 2 hours, minute 20 (idempotent: only ever touches null source_detail rows).
SELECT cron.schedule('draft-provenance-backfill', '20 */2 * * *', 'SELECT public.backfill_draft_provenance();');
