import React from 'react';
import type { DtcComparisonV1, DtcComparisonSourceLink } from '../../lib/dtcComparisonTypes';
import { validComparison } from '../../hooks/useDtcComparisonVisibility';
import './DtcComparisonSection.css';

function shortDate(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed) : '';
}

function SourceList({ links, entityId, side, name }: { links: DtcComparisonSourceLink[]; entityId: string; side: string; name: string }) {
  return <ul className="rise-comparison-sources">{links.filter(link => link.entity_id === entityId).map((link, index) =>
    <li key={`${link.url}-${index}`}><a href={link.url} target="_blank" rel="noopener noreferrer" data-comparison-source={side}>{link.label || `View ${name} source`} <span aria-hidden="true">↗</span></a>{link.checked_at ? <time dateTime={link.checked_at}>Checked {shortDate(link.checked_at)}</time> : null}</li>
  )}</ul>;
}

export function DtcComparisonSection({ comparison }: { comparison: DtcComparisonV1 | null }) {
  if (!validComparison(comparison)) return null;
  return <section className="rise-comparison" aria-labelledby="rise-comparison-heading" data-comparison-revision={comparison.revision_id}>
    <div className="rise-comparison-inner">
      <div className="rise-comparison-intro"><p className="rise-chapter">Public comparison</p><h2 id="rise-comparison-heading">A useful point of comparison</h2><p>Selected from public evidence where the products and shopper situation were comparable.</p></div>
      <div className="rise-comparison-list">{comparison.observations.map((o, index) => {
        const ownId = o.store_entity_ids.prospect;
        const peerId = o.store_entity_ids.peer;
        const images = o.evidence_images || [];
        return <article key={o.id} className="rise-comparison-observation" data-comparison-observation={o.id}>
          <div className="rise-comparison-count">0{index + 1} <span>/ 0{comparison.observations.length}</span></div>
          <div className="rise-comparison-body">
            <p className="rise-comparison-relation">{o.relationship === 'close_alternative' ? 'Close alternative' : 'Category benchmark'} <span>·</span> {o.capability.replaceAll('_', ' ')}</p>
            <h3>{o.title}</h3>
            <p className="rise-comparison-why">{o.why_relevant}</p>
            <div className="rise-comparison-sides">
              <div><p className="rise-comparison-side-label">Your store</p><h4>{o.store_names.prospect}</h4><p>{o.own_observation}</p><SourceList links={o.source_links} entityId={ownId} side="prospect" name={o.store_names.prospect} /></div>
              <div><p className="rise-comparison-side-label">Compared store</p><h4>{o.store_names.peer}</h4><p>{o.peer_observation}</p><SourceList links={o.source_links} entityId={peerId} side="peer" name={o.store_names.peer} /></div>
            </div>
            {images.length ? <div className="rise-comparison-images">{images.map((image, i) => <figure key={`${image.url}-${i}`}><img src={image.url} alt={image.alt} loading="lazy" /><figcaption>Evidence image · {image.alt}</figcaption></figure>)}</div> : null}
            <div className="rise-comparison-test"><span>Worth testing</span><p>{o.proposed_test}</p></div>
            <p className="rise-comparison-limits">Evidence checked {shortDate(comparison.observed_at)}. {o.limitations}</p>
          </div>
        </article>;
      })}</div>
    </div>
  </section>;
}
