import React, { useState } from 'react';
import { submitGrade, submitGradeCapture, type GradeVerdict } from '../lib/gradeApi';

// ── Black Box canon v4 (same tokens as ScanReportPage; module-private by convention) ──
const SERIF = '"Schibsted Grotesk", system-ui, -apple-system, sans-serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const INK = '#131210';
const RED = '#C8361B';
const PAPER = '#FFFFFF';
const MUTED = '#6B675E';
const SEC = '#4A463E';
const HAIR = '#C9C2B2';

const PAGE_VARS: React.CSSProperties = {
  ['--color-paper' as any]: PAPER,
  ['--color-ink' as any]: INK,
  ['--color-hairline' as any]: HAIR,
  background: PAPER,
  color: INK,
  minHeight: '100vh',
};

// The composition's single red lives on the rewrite figure in the verdict panel,
// so the wordmark here renders ink-only (unlike scan reports, where ON carries it).
const Wordmark: React.FC = () => (
  <span style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.02em', fontSize: 18, lineHeight: 1, color: INK, whiteSpace: 'nowrap' }}>
    INBOUND<span style={{ fontWeight: 900 }}>ON</span>STEROIDS
  </span>
);

const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, ...style }}>
    {children}
  </div>
);

// Ten-cell measurement strip, filled to round(pct/10).
const CellStrip: React.FC<{ pct: number; fillColor?: string }> = ({ pct, fillColor = INK }) => {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ width: 16, height: 22, border: `1.5px solid ${INK}`, background: i < filled ? fillColor : 'transparent' }} />
      ))}
    </div>
  );
};

const inputBase: React.CSSProperties = {
  width: '100%',
  fontFamily: BODY_SERIF,
  fontSize: 16,
  color: INK,
  background: PAPER,
  border: `1.5px solid ${INK}`,
  borderRadius: 0,
  padding: '12px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

type Stage = 'form' | 'grading' | 'verdict';

const ScanGradePage: React.FC = () => {
  const [hook, setHook] = useState('');
  const [audience, setAudience] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [verdict, setVerdict] = useState<GradeVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [captureState, setCaptureState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const handleGrade = async () => {
    const trimmed = hook.trim();
    if (trimmed.length < 10) {
      setError('Paste the actual hook. Ten characters minimum.');
      return;
    }
    setError(null);
    setStage('grading');
    try {
      const v = await submitGrade(trimmed, audience.trim());
      setVerdict(v);
      setStage('verdict');
    } catch (e) {
      setError('The grader hit a snag. Give it another run.');
      setStage('form');
    }
  };

  const handleCapture = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setCaptureState('error');
      return;
    }
    setCaptureState('sending');
    try {
      await submitGradeCapture({ email: email.trim(), hook: hook.trim(), audience: audience.trim(), verdict });
      setCaptureState('done');
    } catch {
      setCaptureState('error');
    }
  };

  return (
    <div style={PAGE_VARS}>
      {/* header */}
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `2.5px solid ${INK}` }}>
        <Wordmark />
        <Label>Instrument 01 — Hook Grader</Label>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 96px' }}>
        {/* hero */}
        <Label>The Hook Grader</Label>
        <h1 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(32px, 6vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1.04, margin: '10px 0 16px', color: INK }}>
          Paste your hook. See who it lets in.
        </h1>
        <p style={{ fontFamily: BODY_SERIF, fontSize: 17, lineHeight: 1.55, color: SEC, margin: 0 }}>
          Built on 5,092 hooks pulled from 53 LinkedIn creators, 2,014 timestamped comments, and 731 commenters scored one by one against a real buyer filter.
        </p>

        {/* method block */}
        <div style={{ borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, padding: '20px 0', margin: '32px 0' }}>
          <Label style={{ marginBottom: 10 }}>The work behind the number</Label>
          <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, lineHeight: 1.6, color: SEC, margin: '0 0 10px' }}>
            I pulled 5,092 hooks from 53 B2B creators, every one with its real engagement attached. Then I scored 731 real commenters from giveaway posts the same way I score my own leads. The best comment section came out at 21% real buyers. The worst came out at 6%. Eight or nine out of ten people on every list were nowhere near buying.
          </p>
          <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, lineHeight: 1.6, color: SEC, margin: 0 }}>
            The grader holds your hook against that scale. It measures one thing: the buyer share of the crowd your hook pulls in. Comment volume is a separate problem this tool does not touch.
          </p>
        </div>

        {/* input */}
        {stage !== 'verdict' && (
          <div>
            <Label style={{ marginBottom: 8 }}>Your lead magnet hook</Label>
            <textarea
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="The first two lines of your post, or the title of the thing you give away."
              style={{ ...inputBase, resize: 'vertical' }}
            />
            <div style={{ height: 16 }} />
            <Label style={{ marginBottom: 8 }}>Who you sell to (optional)</Label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              maxLength={200}
              placeholder="e.g. ecom founders, SaaS marketing leads. Blank is fine."
              style={inputBase}
            />
            <div style={{ height: 20 }} />
            <button
              onClick={handleGrade}
              disabled={stage === 'grading'}
              style={{
                fontFamily: SERIF, fontWeight: 800, fontSize: 15, letterSpacing: '0.1em',
                background: stage === 'grading' ? MUTED : INK, color: PAPER,
                border: 'none', borderRadius: 0, padding: '14px 34px', cursor: stage === 'grading' ? 'wait' : 'pointer',
              }}
            >
              {stage === 'grading' ? 'READING THE HOOK…' : 'GRADE IT'}
            </button>
            {stage === 'grading' && (
              <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 14.5, color: MUTED, marginTop: 14 }}>
                Holding it against the measured lists. Takes about fifteen seconds.
              </p>
            )}
            {error && (
              <p style={{ fontFamily: BODY_SERIF, fontSize: 14.5, color: INK, marginTop: 14 }}>{error}</p>
            )}
          </div>
        )}

        {/* verdict */}
        {stage === 'verdict' && verdict && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <Label>Hook Grader. Live verdict</Label>
              <Label>For agency owners</Label>
            </div>

            {/* THE BOX: heavy rule + hairline offset outside */}
            <div style={{ border: `1px solid ${HAIR}`, padding: 5 }}>
              <div style={{ border: `3px solid ${INK}`, padding: '22px 22px 26px' }}>
                <Label style={{ marginBottom: 10 }}>The hook you pasted</Label>
                <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 1.5, color: INK, margin: '0 0 26px', whiteSpace: 'pre-wrap' }}>
                  {verdict.hook}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: 18 }}>
                  <div>
                    <Label style={{ marginBottom: 8 }}>As run. {verdict.width_verdict} hook</Label>
                    <CellStrip pct={verdict.fit_estimate_pct} />
                  </div>
                  <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 44, letterSpacing: '-0.02em', color: INK }}>
                    {verdict.fit_estimate_pct}%
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: 18, marginTop: 18 }}>
                  <div>
                    <Label style={{ marginBottom: 8 }}>After the rewrite</Label>
                    {/* strip stays ink: the composition's single red is the rewrite figure */}
                    <CellStrip pct={verdict.rewrite_fit_estimate_pct} />
                    <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 15.5, color: SEC, margin: '12px 0 0', maxWidth: 420 }}>
                      "{verdict.rewrite}"
                    </p>
                  </div>
                  <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 44, letterSpacing: '-0.02em', color: RED }}>
                    {verdict.rewrite_fit_estimate_pct}%
                  </div>
                </div>
              </div>
            </div>

            {/* prose rows */}
            <div style={{ marginTop: 26 }}>
              {([
                ['Who it lets in', verdict.lets_in],
                ['Who scrolls past', verdict.turns_away],
                ['The leak', verdict.the_leak],
                ['One move', verdict.one_move],
              ] as const).map(([label, text]) => (
                <div key={label} style={{ borderTop: `1px solid ${HAIR}`, padding: '14px 0' }}>
                  <Label style={{ marginBottom: 6 }}>{label}</Label>
                  <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, lineHeight: 1.55, color: SEC, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>

            <p style={{ fontFamily: BODY_SERIF, fontSize: 14.5, lineHeight: 1.55, color: MUTED, margin: '18px 0 0' }}>
              A tighter hook usually means fewer commenters and a larger share of buyers. That trade is the point.
            </p>

            {/* capture */}
            <div style={{ border: `1.5px solid ${INK}`, padding: '22px 22px 24px', marginTop: 34 }}>
              {captureState === 'done' ? (
                <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, color: INK, margin: 0 }}>
                  On its way. Check your inbox in the next day or so.
                </p>
              ) : (
                <>
                  <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, lineHeight: 1.55, color: INK, margin: '0 0 14px' }}>
                    Want the full breakdown, the rewrite reasoning and the fit math, in your inbox?
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (captureState === 'error') setCaptureState('idle'); }}
                      type="email"
                      placeholder="your email"
                      style={{ ...inputBase, flex: '1 1 220px', width: 'auto' }}
                    />
                    <button
                      onClick={handleCapture}
                      disabled={captureState === 'sending'}
                      style={{
                        fontFamily: SERIF, fontWeight: 800, fontSize: 14, letterSpacing: '0.1em',
                        background: INK, color: PAPER, border: 'none', borderRadius: 0,
                        padding: '12px 24px', cursor: captureState === 'sending' ? 'wait' : 'pointer',
                      }}
                    >
                      {captureState === 'sending' ? 'SENDING…' : 'SEND THE BREAKDOWN'}
                    </button>
                  </div>
                  {captureState === 'error' && (
                    <p style={{ fontFamily: BODY_SERIF, fontSize: 14, color: INK, margin: '10px 0 0' }}>
                      That email did not go through. Check it and try again.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* tier-2 handoff */}
            <p style={{ fontFamily: BODY_SERIF, fontSize: 15, lineHeight: 1.55, color: SEC, margin: '26px 0 0' }}>
              I also built a longer one that reads your whole inbound setup and lead magnet. No call needed, you just get the read.{' '}
              <a href="https://ivanmanfredi.com/audit" style={{ color: INK, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Run the full scan →
              </a>
            </p>

            <button
              onClick={() => { setStage('form'); setVerdict(null); setCaptureState('idle'); }}
              style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'transparent', color: MUTED, border: 'none', padding: 0, marginTop: 30, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Grade another hook
            </button>
          </div>
        )}

        {/* fine print */}
        <p style={{ fontFamily: BODY_SERIF, fontSize: 13, lineHeight: 1.55, color: MUTED, margin: '56px 0 0', borderTop: `1px solid ${HAIR}`, paddingTop: 16 }}>
          Fit estimates are calibrated to measured comment sections: the real range runs 6 to 21 percent, and nothing cold clears about 35. If your hook scores 6, that is what 6 looks like on a real list. Data pulled July 2026; method and raw numbers on request.
        </p>
      </main>
    </div>
  );
};

export default ScanGradePage;
