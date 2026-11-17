/** Same images, fewer bytes: a public lm-og object goes through Supabase's resize endpoint at the width it renders. */
const BASE = `${(((import.meta as any).env?.VITE_SUPABASE_URL as string) || 'https://bjbvqvzbzczjbatgmccb.supabase.co').replace(/\/$/, '')}/storage/v1`;
const OBJECT = `${BASE}/object/public/lm-og/`, RENDER = `${BASE}/render/image/public/lm-og/`;
const ANY_OBJECT = /^(https:\/\/[^/]+\/storage\/v1)\/object\/public\/lm-og\/(.+)$/;

export function storageImage(url: string | undefined, width: number): string | undefined {
 if (!url) return url;
 const m = url.startsWith(OBJECT) ? [url, BASE, url.slice(OBJECT.length)] : url.match(ANY_OBJECT);
 if (!m) return url;
 const [key, query] = m[2].split('?');
 const base = m[1] === BASE ? RENDER : `${m[1]}/render/image/public/lm-og/`;
 return `${base}${key}?width=${width}&quality=75${query ? `&${query}` : ''}`;
}
