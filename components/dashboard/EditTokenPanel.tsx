import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function EditTokenPanel() {
  const [revealed, setRevealed] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    try {
      setError(null);
      setLoading(true);
      const { data, error: invokeErr } = await supabase.functions.invoke('lm-edit-token-reveal', {
        body: {},
      });
      if (invokeErr) throw invokeErr;
      const t = (data as { token?: string } | null)?.token;
      if (!t) throw new Error('no token returned');
      setToken(t);
      setRevealed(true);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  }

  return (
    <div
      style={{
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        padding: 14,
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13 }}>LM Editor Token</div>
      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
        Append <code>?edit=&lt;token&gt;</code> to any engine LM URL to enable inline editing.
      </div>
      {!revealed ? (
        <button
          onClick={reveal}
          disabled={loading}
          style={{
            padding: '6px 12px',
            border: '1px solid #2A8F65',
            background: loading ? '#7fb89e' : '#2A8F65',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 12,
            alignSelf: 'flex-start',
          }}
        >
          {loading ? 'Revealing…' : 'Reveal token'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <code
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              overflow: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {token}
          </code>
          <button
            onClick={copy}
            style={{
              padding: '6px 12px',
              border: '1px solid #2A8F65',
              background: '#fff',
              color: '#2A8F65',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
      {error && <div style={{ color: '#c62828', fontSize: 12 }}>{error}</div>}
    </div>
  );
}
