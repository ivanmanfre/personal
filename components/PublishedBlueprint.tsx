import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BlueprintStyles from './blueprint/BlueprintStyles';

interface BlueprintRow {
  id: string;
  html: string;
  json_sections: Record<string, unknown>;
  status: string;
  share_token: string | null;
  published_at: string | null;
}

const PublishedBlueprint: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [row, setRow] = useState<BlueprintRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('blueprints')
        .select('id, html, json_sections, status, share_token, published_at')
        .eq('share_token', token)
        .eq('status', 'published')
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      else if (!data) setError('This Blueprint is not available.');
      else setRow(data as BlueprintRow);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-sm text-ink-muted">
        Loading…
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 font-mono text-sm">
        <p className="text-ink-muted text-center max-w-md">
          {error || 'This Blueprint link is no longer active.'}
        </p>
        <a href="https://ivanmanfredi.com" className="text-accent underline text-xs uppercase tracking-widest">ivanmanfredi.com</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/10">
        <div className="max-w-[1080px] mx-auto px-6 py-4 flex items-center justify-between">
          <a href="https://ivanmanfredi.com" className="font-mono text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink transition-colors">
            ivanmanfredi.com
          </a>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest border border-ink/20 hover:border-ink/40 transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
      </header>

      <main className="max-w-[1080px] mx-auto px-6 py-10">
        <div
          className="blueprint-content"
          style={{
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '17px',
            lineHeight: 1.6,
            color: '#1A1A1A',
          }}
          dangerouslySetInnerHTML={{ __html: row.html }}
        />
      </main>

      <BlueprintStyles />
    </div>
  );
};

export default PublishedBlueprint;
