import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Send, Loader2, Copy, Check, ListChecks, MessageSquare, Mail, Monitor, Video, Users } from 'lucide-react';
import { supabase } from '../../../../../lib/supabase';
import { toastSuccess, toastError } from '../../../../../lib/dashboardActions';
import type { MeetingTranscript, MeetingBrief } from '../../../../../types/dashboard';

/*
 * Meeting card — Black Box v4 restyle of the v1 MeetingCard. Categorical chips
 * (amber action-count, purple topic-count, cyan screen) flatten to ink labels.
 * The fit-score badge stays SEMANTIC, distinguished by weight/box not hue.
 *
 * Write-path A (Create Proposal, MUT): the n8n webhook fetch is verbatim from
 * the v1 component. The recording player calls the read-only call-recording-url
 * edge function verbatim (real signed URLs; never mocked over).
 */

function parseItem(item: any): Record<string, any> {
  if (typeof item === 'string') { try { return JSON.parse(item); } catch { return { text: item }; } }
  return item || {};
}

function fitClass(score: number | null | undefined): string {
  if (score == null) return 'cl-fit';
  if (score >= 4) return 'cl-fit cl-fit--strong';
  if (score >= 3) return 'cl-fit cl-fit--mid';
  return 'cl-fit';
}

function briefIsEmpty(b: MeetingBrief | null | undefined): boolean {
  if (!b) return true;
  const has = (v: any) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '');
  return !(
    has(b.pain) || has(b.stack) || has(b.decision_maker) || has(b.budget_signal) ||
    has(b.timeline) || has(b.triggers) || has(b.objections) || has(b.fit_score) ||
    has(b.proposal_hook) || has(b.next_step) || has(b.industry) ||
    has(b.automation_maturity) || has(b.team_size)
  );
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Read-only recording playback: locates the call A/V in the private
// call-recordings bucket via the call-recording-url edge function. Verbatim.
const CallRecordingPlayer: React.FC<{ meetingDate: string }> = ({ meetingDate }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'none'>('loading');
  const [webcam, setWebcam] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('call-recording-url', { body: { date: meetingDate } });
        if (cancelled) return;
        if (error || !data?.ok || (!data.webcam && !data.audio)) { setStatus('none'); return; }
        setWebcam(data.webcam ?? null);
        setAudio(data.audio ?? null);
        setStatus('ready');
      } catch { if (!cancelled) setStatus('none'); }
    })();
    return () => { cancelled = true; };
  }, [meetingDate]);

  if (status === 'loading') {
    return <div className="cl-sec"><span className="cl-rec-loading"><Loader2 className="w-3 h-3 animate-spin" /> Looking for recording</span></div>;
  }
  if (status === 'none') return null;

  return (
    <div className="cl-sec">
      <div className="cl-sec-h"><Video className="w-3.5 h-3.5" /> Recording</div>
      <div className="cl-rec">
        {webcam ? <video src={webcam} controls playsInline preload="metadata" /> : audio ? <audio src={audio} controls preload="metadata" /> : null}
      </div>
    </div>
  );
};

const BriefSection: React.FC<{ brief: MeetingBrief }> = ({ brief }) => {
  const pain = brief.pain?.filter(Boolean) || [];
  const stack = brief.stack?.filter(Boolean) || [];
  const triggers = brief.triggers?.filter(Boolean) || [];
  const objections = brief.objections?.filter(Boolean) || [];
  const meta: React.ReactNode[] = [];
  if (brief.industry) meta.push(<span className="cl-tag" key="ind"><b>Industry</b> {brief.industry}</span>);
  if (brief.team_size) meta.push(<span className="cl-tag" key="team"><b>Team</b> {brief.team_size}</span>);
  if (brief.automation_maturity) meta.push(<span className="cl-tag" key="mat"><b>Maturity</b> {brief.automation_maturity}</span>);
  if (brief.timeline) meta.push(<span className="cl-tag" key="tl"><b>Timeline</b> {brief.timeline}</span>);
  if (brief.budget_signal) meta.push(<span className="cl-tag" key="bdg"><b>Budget</b> {brief.budget_signal}</span>);

  return (
    <div className="cl-sec">
      <div className="cl-sec-h" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>Brief</span>
        {brief.fit_score != null && <span className={`${fitClass(brief.fit_score)} cl-brief-fit`}>Fit {brief.fit_score}/5</span>}
      </div>
      {meta.length > 0 && <div className="cl-brief-meta">{meta}</div>}
      {brief.decision_maker && <div className="cl-sec-body" style={{ marginBottom: '0.5rem' }}><b style={{ color: 'var(--ec-mutedc)', fontWeight: 700, fontSize: 10 }}>DM </b>{brief.decision_maker}</div>}
      {pain.length > 0 && (
        <>
          <div className="cl-sub-lbl">Pain</div>
          <div className="cl-list">{pain.map((p, i) => <div className="cl-list-item cl-list-item--danger" key={i}>{p}</div>)}</div>
        </>
      )}
      {stack.length > 0 && (
        <>
          <div className="cl-sub-lbl">Stack</div>
          <div className="cl-brief-meta">{stack.map((s, i) => <span className="cl-tag" key={i}>{s}</span>)}</div>
        </>
      )}
      {triggers.length > 0 && (
        <>
          <div className="cl-sub-lbl">Triggers</div>
          <div className="cl-brief-meta">{triggers.map((t, i) => <span className="cl-tag" key={i}>{t}</span>)}</div>
        </>
      )}
      {objections.length > 0 && (
        <>
          <div className="cl-sub-lbl">Objections</div>
          <div className="cl-list">{objections.map((o, i) => <div className="cl-list-item" key={i}>{o}</div>)}</div>
        </>
      )}
      {brief.proposal_hook && (
        <div className="cl-hook">
          <div className="cl-sub-lbl" style={{ marginTop: 0 }}>Proposal hook</div>
          <p className="cl-hook-q">"{brief.proposal_hook}"</p>
        </div>
      )}
      {brief.next_step && <div className="cl-sec-body" style={{ marginTop: '0.5rem' }}><b style={{ color: 'var(--ec-mutedc)', fontWeight: 700, fontSize: 10 }}>NEXT </b>{brief.next_step}</div>}
    </div>
  );
};

const MeetingCard: React.FC<{ meeting: MeetingTranscript }> = ({ meeting }) => {
  const [expanded, setExpanded] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = meeting.title.replace(/\s*\/\s*$/, '');

  const screenContextSeparator = '--- SCREEN CONTEXT';
  const hasScreenContext = meeting.transcriptText?.includes(screenContextSeparator);
  const screenContext = hasScreenContext
    ? meeting.transcriptText.split(screenContextSeparator)[1]?.replace(/^[^-]*---\n?/, '').trim()
    : null;
  const transcriptOnly = hasScreenContext
    ? meeting.transcriptText.split(screenContextSeparator)[0].trim()
    : meeting.transcriptText;

  // Write-path A — verbatim n8n proposal webhook (MUT).
  const handleCreateProposal = async () => {
    setCreatingProposal(true);
    try {
      const res = await fetch('https://n8n.ivanmanfredi.com/webhook/proposal-upwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meeting.title,
          participants: meeting.participants,
          summary: meeting.summary || '',
          transcript: meeting.transcriptText || '',
          action_items: meeting.actionItems.map((a) => {
            const p = parseItem(a);
            return p.action || p.description || p.task || p.text || JSON.stringify(a);
          }),
          date: meeting.date,
          source: 'meetings_panel',
        }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      toastSuccess('Proposal creation started');
    } catch (err) {
      toastError('create proposal', err);
    } finally {
      setCreatingProposal(false);
    }
  };

  const handleCopy = () => {
    const actions = meeting.actionItems.map((a) => {
      const p = parseItem(a);
      const text = p.action || p.description || p.task || p.text || JSON.stringify(a);
      return p.owner ? `- ${p.owner}: ${text}` : `- ${text}`;
    }).join('\n');
    const text = `Meeting: ${title}\nDate: ${fmtDate(meeting.date)}\nParticipants: ${meeting.participants.join(', ')}\n\nSummary:\n${meeting.summary || 'N/A'}\n\nAction Items:\n${actions || 'None'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const actionCount = meeting.actionItems.length;
  const topicCount = meeting.topics.length;

  return (
    <div className="cl-card">
      <button className="cl-card-head" onClick={() => setExpanded(!expanded)}>
        <div className="cl-card-main">
          <div className="cl-card-title">
            {title}
            {meeting.durationMinutes > 0 && <span className="cl-card-dur">{meeting.durationMinutes}m</span>}
          </div>
          <div className="cl-card-meta">
            <span>{fmtDate(meeting.date)}</span>
            <span className="cl-card-sep">|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Users className="w-3 h-3" /> {meeting.participants.join(', ')}</span>
          </div>
          {meeting.summary && !expanded && <div className="cl-card-summary">{meeting.summary}</div>}
        </div>
        <div className="cl-card-chips">
          {actionCount > 0 && <span className="cl-chip">{actionCount} action{actionCount > 1 ? 's' : ''}</span>}
          {topicCount > 0 && <span className="cl-chip">{topicCount} topic{topicCount > 1 ? 's' : ''}</span>}
          {hasScreenContext && <span className="cl-chip"><Monitor className="w-3 h-3" /> Screen</span>}
          {meeting.brief?.fit_score != null && <span className={fitClass(meeting.brief.fit_score)}>Fit {meeting.brief.fit_score}/5</span>}
          <span className="cl-card-chev">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </div>
      </button>

      {expanded && (
        <div className="cl-card-body">
          <CallRecordingPlayer meetingDate={meeting.date} />

          {!briefIsEmpty(meeting.brief) && meeting.brief && <BriefSection brief={meeting.brief} />}

          {meeting.summary && (
            <div className="cl-sec">
              <div className="cl-sec-h">Summary</div>
              <p className="cl-sec-body">{meeting.summary}</p>
            </div>
          )}

          {actionCount > 0 && (
            <div className="cl-sec">
              <div className="cl-sec-h"><ListChecks className="w-3.5 h-3.5" /> Action items</div>
              <div>
                {meeting.actionItems.map((item, i) => {
                  const p = parseItem(item);
                  const action = p.action || p.description || p.task || p.text || (typeof item === 'string' ? item : JSON.stringify(item));
                  return (
                    <div className="cl-ai" key={i}>
                      <div className="cl-ai-body">
                        <div className="cl-ai-txt">{action}</div>
                        {(p.owner || p.deadline) && (
                          <div className="cl-ai-meta">
                            {p.owner && <span className="cl-ai-owner">{p.owner}</span>}
                            {p.deadline && <span className="cl-ai-due">Due {p.deadline}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {topicCount > 0 && (
            <div className="cl-sec">
              <div className="cl-sec-h"><MessageSquare className="w-3.5 h-3.5" /> Content topics extracted</div>
              <div className="cl-topics">
                {meeting.topics.map((t, i) => {
                  const p = parseItem(t);
                  const tt = p.title || p.topic || p.name || p.text || (typeof t === 'string' ? t : '');
                  const short = tt.length > 80 ? tt.slice(0, 77) + '...' : tt;
                  return (
                    <span className="cl-topic" key={i}>
                      <span>{short}</span>
                      {p.post_format && <span className="cl-topic-fmt">{p.post_format}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {meeting.followUpDraft && (
            <div className="cl-sec">
              <div className="cl-sec-h"><Mail className="w-3.5 h-3.5" /> Follow-up draft</div>
              <div className="cl-followup">{meeting.followUpDraft}</div>
            </div>
          )}

          {screenContext && (
            <div className="cl-sec">
              <div className="cl-sec-h"><Monitor className="w-3.5 h-3.5" /> Screen context</div>
              <div className="cl-screen">{screenContext}</div>
            </div>
          )}

          {transcriptOnly && (
            <div className="cl-sec">
              <details className="cl-transcript">
                <summary><FileText className="w-3.5 h-3.5" /> Full transcript</summary>
                <pre>{transcriptOnly}</pre>
              </details>
            </div>
          )}

          <div className="cl-card-acts">
            <button className="cl-act" onClick={handleCopy}>
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy summary'}
            </button>
            <button className="cl-act cl-act--primary" onClick={handleCreateProposal} disabled={creatingProposal}>
              {creatingProposal ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating</> : <><Send className="w-3 h-3" /> Create proposal</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingCard;
