import { useEffect, useState } from 'react';
import { Check, ImageOff } from 'lucide-react';
import { listPhotos, type Photo } from '../data/api';
import { track } from '../data/track';

const cache = new Map<string, Promise<Photo[]>>();
/** The client's photo library, read once per page. */
export function usePhotos(slug: string) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  useEffect(() => {
    let live = true;
    if (!cache.has(slug)) cache.set(slug, listPhotos(slug).catch(() => []));
    cache.get(slug)!.then(p => { if (live) setPhotos(p); });
    return () => { live = false; };
  }, [slug]);
  return photos;
}

/** Posts whose picture is one photo (text, single image): the formats the board can swap. */
export const photoSwappable = (style: string) => style === 'text' || style === 'single_image' || style === 'image';

export function PhotoPicker({ photos, current, onPick, onClose }: { photos: Photo[]; current?: string; onPick: (url: string) => void; onClose: () => void }) {
  const [shown, setShown] = useState(24);
  useEffect(() => { track('expand', null, { which: 'photo_library' }); }, []);
  const cur = (current || '').split('?')[0];
  return (
    <div className="rounded-[14px] border hair p-4" data-testid="photo-picker">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="eyebrow">Pick a photo · {photos.length} in your library</div>
        <button className="btn btn-text btn-sm !h-8" onClick={onClose}>Close</button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {photos.slice(0, shown).map(p => {
          const on = cur === p.url;
          return (
            <button key={p.name} onClick={() => !on && onPick(p.url)} aria-pressed={on} aria-label={on ? 'Current picture' : 'Use this photo'}
              className={`relative aspect-square overflow-hidden rounded-[8px] bg-sunk border ${on ? 'border-[var(--accent)]' : 'hair hover:border-[var(--line-bold)]'}`} data-testid="photo-option">
              <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
              {on && <span className="absolute top-1 right-1 h-5 w-5 rounded-full inline-flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><Check size={12} /></span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {photos.length > shown && <button className="btn btn-outline btn-sm" onClick={() => setShown(n => n + 36)}>Show more</button>}
        {current && <button className="btn btn-text btn-sm" onClick={() => onPick('')}><ImageOff size={14} /> No picture</button>}
      </div>
    </div>
  );
}
