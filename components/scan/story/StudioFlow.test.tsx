// @vitest-environment jsdom
import React from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
vi.mock('framer-motion', async () => {
 const React = await import('react');
 const cache = new Map();
 return {useInView: () => true,
 AnimatePresence: ({children}: any) => children,
 motion: new Proxy({}, {get: (_, tag: string) => {
  if (!cache.has(tag)) cache.set(tag, React.forwardRef(({children, initial, animate, exit, transition, ...props}: any, ref: any) => React.createElement(tag, {...props, ref}, children)));
  return cache.get(tag);
 }})};
});
vi.mock('./motion', () => ({Beams: () => null}));
vi.mock('./context', () => ({useStory: () => ({founderName:'Hatim Abbas',buyerRole:'Business owner',message:'Hi Alex, here is your guide.', flow:{messages:['Hatim: Here is the guide.', 'Alex: Thanks.', 'Hatim: Is this useful?'],checks:[{label:'Fit',value:'Yes'},{label:'Timing',value:'Now'},{label:'Decision',value:'Owner'}],callTitle:'Discovery call'}})}));
import {StoryFlow} from './StudioFlow';
let media: EventTarget & {matches: boolean};
let addListener: ReturnType<typeof vi.fn>, removeListener: ReturnType<typeof vi.fn>;
function setReduced(matches: boolean) {
 Object.defineProperty(media, 'matches', {value: matches, configurable: true});
 act(() => media.dispatchEvent(new Event('change')));
}
beforeEach(() => {
 const target = new EventTarget();
 addListener = vi.fn(target.addEventListener.bind(target));
 removeListener = vi.fn(target.removeEventListener.bind(target));
 media = Object.assign(target, {matches: true, media: '(prefers-reduced-motion: reduce)', addEventListener: addListener, removeEventListener: removeListener});
 vi.stubGlobal('matchMedia', vi.fn(() => media));
});
afterEach(() => {cleanup();vi.unstubAllGlobals();vi.useRealTimers()});
it('keeps the complete outcome when a reduced-motion reader changes sources', () => {
 const {container}=render(<StoryFlow founder="Hatim"/>);
 for (const name of [/Warm outreach/,/Signal-based outreach/,/Content & lead magnets/]) {
  fireEvent.click(screen.getByRole('button',{name}));
  expect(container.querySelectorAll('.sf-qualify>div.is-on')).toHaveLength(3);
  expect(screen.getByText('Booked in your calendar')).toBeTruthy();
  expect(screen.queryByLabelText('Play the example')).toBeNull();
 }
});
it('completes the outcome when reduced motion is enabled during the session', () => {
 vi.useFakeTimers();
 setReduced(false);
 const {container}=render(<StoryFlow founder="Hatim"/>);
 expect(container.querySelectorAll('.sf-qualify>div.is-on')).toHaveLength(1);
 expect(screen.getByLabelText('Pause the example')).toBeTruthy();
 act(() => vi.advanceTimersByTime(2600));
 expect(container.querySelectorAll('.sf-qualify>div.is-on')).toHaveLength(2);
 setReduced(true);
 expect(container.querySelectorAll('.sf-qualify>div.is-on')).toHaveLength(3);
 expect(screen.getByText('Booked in your calendar')).toBeTruthy();
 expect(screen.queryByLabelText('Pause the example')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Signal-based outreach/}));
 act(() => vi.advanceTimersByTime(10000));
 expect(container.querySelectorAll('.sf-qualify>div.is-on')).toHaveLength(3);
 expect(screen.getByText('Booked in your calendar')).toBeTruthy();
 expect(screen.getByRole('button',{name:/Signal-based outreach/}).getAttribute('aria-pressed')).toBe('true');
});
it('removes the reduced-motion listener on unmount', () => {
 const {unmount}=render(<StoryFlow founder="Hatim"/>);
 expect(addListener).toHaveBeenCalledWith('change', expect.any(Function));
 unmount();
 expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function));
 expect(removeListener.mock.calls[0][1]).toBe(addListener.mock.calls[0][1]);
});
