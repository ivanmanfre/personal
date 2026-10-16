import type { QueueItem } from '../ClientBoardPage';
import { srcLabelClient } from './clientSourceLabel';

function sourceLink(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

/** Ownership and outlier status need recorded provenance. A URL establishes platform only.
 * Supporting/fact-check URLs do not establish where the content idea came from. */
export function postSourceOrigin(item: Pick<QueueItem, 'source_detail' | 'source_label'>): { label: string; href?: string } {
  const detail = item.source_detail;
  const href = sourceLink(detail?.source_url) || sourceLink(detail?.url);
  const host = href ? new URL(href).hostname.replace(/^www\./, '') : '';
  const kind = (detail?.kind || '').toLowerCase().replace(/[_-]/g, ' ');
  if (kind === 'strategy') return { label: 'Source pending' };
  const labels = [detail?.source, detail?.label, item.source_label].map(srcLabelClient).filter(Boolean);
  const evidence = [kind, ...labels].join(' ').toLowerCase();
  const contentBrain = /\bcontent\s*brain\b/.test(evidence);
  const youtube = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || /\byoutube\b/.test(evidence);
  const instagram = host === 'instagram.com' || host.endsWith('.instagram.com') || /\binstagram\b/.test(evidence);
  if (kind === 'call' || /\b(?:client|sales|discovery) call\b|from your calls?\b/.test(evidence)) return { label: 'Client call', href };
  if (youtube && (kind === 'own posts' || /\b(?:own|owned|your) youtube\b/.test(evidence))) return { label: 'Own YouTube', href };
  if (youtube && /\boutlier\b/.test(evidence)) return { label: contentBrain ? 'YouTube outlier · ContentBrain' : 'YouTube outlier', href };
  if (youtube) return { label: contentBrain ? 'YouTube · ContentBrain' : 'YouTube', href };
  if (instagram) return { label: 'Instagram', href };
  if (kind === 'own posts') return { label: 'Own posts', href };
  // A style-sample batch or lane name is an editorial reference, not source provenance.
  const label = labels.find(label => !/carousel style sample|weekly carousel|content strategy|first-\d+-posts|watch-accounts/i.test(label));
  return { label: label || (href ? 'Original source' : 'Source pending'), href };
}
