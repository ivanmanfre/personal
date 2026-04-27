import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, Save, Mail, Calendar, Trash2 } from 'lucide-react';
import {
  upsertNewsletterIssue,
  approveNewsletterIssue,
  cancelNewsletterIssue,
  sendNewsletterNow,
  deleteNewsletterIssue,
  sendNewsletterTest,
  toastError,
  toastSuccess,
} from '../../lib/dashboardActions';
import type { IssueRow } from '../../hooks/useNewsletter';

interface Props {
  open: boolean;
  issue: IssueRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const FORMATS: { id: string; label: string; cadence: string }[] = [
  { id: 'field_notes', label: 'Field Notes', cadence: 'Tue · 10:00 ET' },
  { id: 'hiring_wall', label: 'Hiring Wall', cadence: 'Fri · 09:00 ET' },
  { id: 'manifesto', label: 'Manifesto', cadence: 'one-off' },
  { id: 'one_off', label: 'One-off', cadence: 'manual' },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function fmtSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const LetterEditor: React.FC<Props> = ({ open, issue, onClose, onSaved }) => {
  const [subject, setSubject] = useState('');
  const [preview, setPreview] = useState('');
  const [body, setBody] = useState('');
  const [format, setFormat] = useState('field_notes');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState<null | string>(null);

  const isNew = !issue?.id;
  const isLocked = issue ? ['sending', 'sent'].includes(issue.status) : false;

  useEffect(() => {
    if (!open) return;
    if (issue) {
      setSubject(issue.subject || '');
      setPreview(issue.preview || '');
      setBody('');
      setFormat(issue.format || 'field_notes');
      setSlug(issue.slug || '');
      setSlugTouched(true);
      // Body needs full row — fetched inline (RLS allows anon select)
      void loadBody(issue.id);
    } else {
      setSubject('');
      setPreview('');
      setBody('');
      setFormat('field_notes');
      setSlug('');
      setSlugTouched(false);
      setTestEmail('');
    }
  }, [open, issue]);

  async function loadBody(id: string) {
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data, error } = await supabase
        .from('newsletter_issues')
        .select('body_markdown')
        .eq('id', id)
        .single();
      if (error) throw error;
      setBody((data as any)?.body_markdown || '');
    } catch (err) {
      toastError('load issue body', err);
    }
  }

  // Auto-slug from subject when creating
  useEffect(() => {
    if (!slugTouched && subject) setSlug(slugify(subject));
  }, [subject, slugTouched]);

  const wordCount = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body]);
  const canSave = subject.trim() && body.trim() && slug.trim() && format && !isLocked;

  async function handleSave() {
    if (!canSave) return;
    setBusy('save');
    try {
      const id = await upsertNewsletterIssue({
        id: issue?.id ?? null,
        slug: slug.trim(),
        subject: subject.trim(),
        preview: preview.trim() || null,
        body_markdown: body,
        format,
      });
      toastSuccess(isNew ? 'Draft created' : 'Draft updated');
      onSaved();
      // Stay open with the new id so user can keep editing or schedule
      if (isNew) {
        // Force a parent refresh; the editor will receive the new issue on next open
        onClose();
      } else {
        // No-op — parent will refresh
      }
      return id;
    } catch (err) {
      toastError('save issue', err);
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    if (!issue?.id || !canSave) return;
    setBusy('approve');
    try {
      // Save first if dirty
      await upsertNewsletterIssue({
        id: issue.id,
        slug: slug.trim(),
        subject: subject.trim(),
        preview: preview.trim() || null,
        body_markdown: body,
        format,
      });
      const slot = await approveNewsletterIssue(issue.id);
      toastSuccess(`Scheduled for ${fmtSlot(slot)}`);
      onSaved();
      onClose();
    } catch (err) {
      toastError('approve issue', err);
    } finally {
      setBusy(null);
    }
  }

  async function handleSendNow() {
    if (!issue?.id) return;
    if (!confirm('Send this issue to the entire audience right now?')) return;
    setBusy('send');
    try {
      await upsertNewsletterIssue({
        id: issue.id,
        slug: slug.trim(),
        subject: subject.trim(),
        preview: preview.trim() || null,
        body_markdown: body,
        format,
      });
      await sendNewsletterNow(issue.id);
      toastSuccess('Queued for immediate send (next 15 min)');
      onSaved();
      onClose();
    } catch (err) {
      toastError('send now', err);
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!issue?.id) return;
    setBusy('cancel');
    try {
      await cancelNewsletterIssue(issue.id);
      toastSuccess('Schedule cancelled · back to draft');
      onSaved();
    } catch (err) {
      toastError('cancel', err);
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!issue?.id) return;
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    setBusy('delete');
    try {
      await deleteNewsletterIssue(issue.id);
      toastSuccess('Draft deleted');
      onSaved();
      onClose();
    } catch (err) {
      toastError('delete', err);
    } finally {
      setBusy(null);
    }
  }

  async function handleTestSend() {
    if (!issue?.id) {
      toastError('test send', new Error('Save the draft first.'));
      return;
    }
    if (!testEmail.trim()) {
      toastError('test send', new Error('Enter a test email address.'));
      return;
    }
    setBusy('test');
    try {
      // Save first so the test renders the latest content
      await upsertNewsletterIssue({
        id: issue.id,
        slug: slug.trim(),
        subject: subject.trim(),
        preview: preview.trim() || null,
        body_markdown: body,
        format,
      });
      await sendNewsletterTest(issue.id, testEmail.trim());
      toastSuccess(`Test sent to ${testEmail}`);
    } catch (err) {
      toastError('test send', err);
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">
              {isNew ? 'New issue' : isLocked ? 'View issue' : 'Edit draft'}
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isLocked ? 'This issue has been sent and is read-only.' : 'Markdown-supported. Save → Approve to ship to next slot.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                disabled={isLocked}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
              >
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label} · {f.cadence}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                disabled={isLocked}
                placeholder="auto-from-subject"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:border-zinc-600 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLocked}
              placeholder="What lands in the inbox"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1">
              Preview <span className="normal-case text-zinc-600">· shown in inbox under subject</span>
            </label>
            <input
              type="text"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              disabled={isLocked}
              maxLength={150}
              placeholder="One-line hook"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
            />
            <p className="text-[10px] text-zinc-600 mt-1">{preview.length}/150</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Body · markdown</label>
              <span className="text-[10px] text-zinc-600">{wordCount} words</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isLocked}
              rows={16}
              placeholder={"Open with the moment.\n\nDevelop the idea.\n\n---\n\nSign off + soft CTA."}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono leading-relaxed focus:border-zinc-600 focus:outline-none disabled:opacity-50 resize-none"
            />
          </div>

          {!isLocked && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-2">Test send</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@yourdomain.com"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none"
                />
                <button
                  onClick={handleTestSend}
                  disabled={busy !== null || !testEmail.trim() || !issue?.id}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {busy === 'test' ? 'Sending…' : 'Test'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                {issue?.id
                  ? 'Sends a single render to the address above. Save first to test the latest content.'
                  : 'Save the draft first, then a test send will be available.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-zinc-800 bg-zinc-950/80">
          <div className="flex flex-wrap items-center gap-2">
            {!isLocked && issue?.id && issue.status === 'draft' && (
              <button onClick={handleDelete} disabled={busy !== null}
                className="px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
            {issue?.status === 'scheduled' && (
              <button onClick={handleCancel} disabled={busy !== null}
                className="px-3 py-2 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
                Cancel schedule
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
              Close
            </button>
            {!isLocked && (
              <>
                <button onClick={handleSave} disabled={!canSave || busy !== null}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {busy === 'save' ? 'Saving…' : 'Save draft'}
                </button>
                {issue?.id && (
                  <>
                    <button onClick={handleApprove} disabled={!canSave || busy !== null}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {busy === 'approve' ? 'Scheduling…' : 'Approve · next slot'}
                    </button>
                    <button onClick={handleSendNow} disabled={!canSave || busy !== null}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" />
                      {busy === 'send' ? 'Sending…' : 'Send now'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LetterEditor;
