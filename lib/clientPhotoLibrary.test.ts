import { describe, expect, it } from 'vitest';
import { isClientLibraryPhoto } from './clientPhotoLibrary';

const file = (name: string) => ({ id: 'photo-id', name });

describe('Mattan personal photo library', () => {
  it('keeps direct personal uploads and imported Instagram photos', () => {
    for (const name of [
      '1784593209518-1-img_1863.jpg',
      '1784593238704-15-img_1005.jpg',
      '1784593247048-17-img_8287.jpg',
      '1790843000000-0-my-photo.PNG',
      '1790843000000-1-my-photo.avif',
      '1790843000000-2-my-photo.gif',
      '1790843000000-3-photo',
      'ig-2018-08-02-attention-is-the-asset-main.jpg',
    ]) expect(isClientLibraryPhoto(file(name), 'risedtc-com')).toBe(true);
  });

  it('excludes generated graphics, case studies and folders from the library', () => {
    for (const name of [
      '2026-09-22-v2-fashion.jpg',
      '2026-09-22-v2-handbag.jpg',
      'casestudy-brand.jpg',
      'slide-01.png',
      'The-Direct-Response-Doom-Loop.pdf',
      '.keep',
      'voice-note.webm',
    ]) expect(isClientLibraryPhoto(file(name), 'risedtc-com')).toBe(false);
    expect(isClientLibraryPhoto({ id: null, name: 'onepost' }, 'risedtc-com')).toBe(false);
  });

  it('preserves other clients existing photo filenames', () => {
    expect(isClientLibraryPhoto(file('founder.jpg'), 'another-board')).toBe(true);
    expect(isClientLibraryPhoto({ id: null, name: 'folder' }, 'another-board')).toBe(false);
  });
});
