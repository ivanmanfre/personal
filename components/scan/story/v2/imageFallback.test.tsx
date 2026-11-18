// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, cleanup, fireEvent} from '@testing-library/react';
import {storageImage, withOriginal} from './storageImage';
import {Avatar} from '../../../dev/scan-walkthrough/journey/ReadingChapter';
import {ProfileAuditSection} from '../../../dev/scan-walkthrough/journey/ProfileAudit';
afterEach(cleanup);

/** Ruling R-IMG: a resized storage URL that fails must load the original object, then hand over to the old fallback. */
const root = 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1';
const original = `${root}/object/public/lm-og/avatar-example-fx1.jpg`;

describe('resized image fallback', () => {
 it('a stored number, object or empty value passes through untouched instead of throwing', () => {
  expect(storageImage(42 as unknown as string, 96)).toBe(42);
  expect(storageImage('', 96)).toBe('');
  expect(storageImage(null as unknown as string, 96)).toBeNull();
 });
 it('first error swaps to the original URL, second error calls the caller fallback', () => {
  const onFail = vi.fn();
  const {container} = render(<img src={storageImage(original, 96)} onError={withOriginal(original, onFail)} alt=""/>);
  const img = container.querySelector('img')!;
  expect(img.getAttribute('src')).toContain('/render/image/public/lm-og/avatar-example-fx1.jpg?width=96');
  fireEvent.error(img);
  expect(img.getAttribute('src')).toBe(original);
  expect(onFail).not.toHaveBeenCalled();
  fireEvent.error(img);
  expect(onFail).toHaveBeenCalledTimes(1);
  expect(img.getAttribute('src')).toBe(original);
 });
 it('a URL storageImage left alone goes straight to the caller fallback', () => {
  const onFail = vi.fn();
  const {container} = render(<img src={storageImage('https://media.example/x.jpg', 96)} onError={withOriginal('https://media.example/x.jpg', onFail)} alt=""/>);
  fireEvent.error(container.querySelector('img')!);
  expect(onFail).toHaveBeenCalledTimes(1);
 });
 it('the avatar tries the original before falling back to initials', () => {
  const {container} = render(<Avatar src={original} name="Marta Quillfeather" alt="Marta Quillfeather"/>);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')!.getAttribute('src')).toBe(original);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toBe('MQ');
 });
 it('profile audit photo and banner fall back to the original', () => {
  const banner = `${root}/object/public/lm-og/profile-banner-example-fx1.jpg`;
  const audit = {findings: [{area: 'headline', label: 'Headline', state: 'present', today: 'Today', quote: '', fix: 'Fix'}, {area: 'about', label: 'About', state: 'present', today: 'Today', quote: '', fix: 'Fix'}], avatarUrl: original, bannerUrl: banner};
  const {container} = render(<ProfileAuditSection audit={audit as any}/>);
  for (const [cls, url] of [['.profile-audit-avatar', original], ['.profile-audit-banner', banner]] as const) {
   const img = container.querySelector<HTMLImageElement>(cls)!;
   expect(img.getAttribute('src')).toContain('/render/image/');
   fireEvent.error(img);
   expect(img.getAttribute('src')).toBe(url);
  }
 });
});
