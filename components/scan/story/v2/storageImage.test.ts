import {describe, it, expect} from 'vitest';
import {storageImage} from './storageImage';
const root = 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1';
describe('storageImage', () => {
 it('rewrites a bucket URL to the resize endpoint', () => expect(storageImage(`${root}/object/public/lm-og/avatar-fabio-1a2b.jpg`, 96)).toBe(`${root}/render/image/public/lm-og/avatar-fabio-1a2b.jpg?width=96&quality=75`));
 it('leaves a foreign URL untouched', () => expect(storageImage('https://media.licdn.com/x.jpg', 96)).toBe('https://media.licdn.com/x.jpg'));
 it('leaves another bucket untouched', () => expect(storageImage(`${root}/object/public/other/x.jpg`, 96)).toBe(`${root}/object/public/other/x.jpg`));
 it('keeps an existing query', () => expect(storageImage(`${root}/object/public/lm-og/cover-x.png?v=2`, 900)).toBe(`${root}/render/image/public/lm-og/cover-x.png?width=900&quality=75&v=2`));
 it('undefined stays undefined', () => expect(storageImage(undefined, 96)).toBeUndefined());
 it('a relative or local asset stays as it is', () => expect(storageImage('/content-system/kyle-portrait.webp', 96)).toBe('/content-system/kyle-portrait.webp'));
});
