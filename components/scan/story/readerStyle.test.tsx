// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import './v2/__fixtures__/dom';
import {readerName, fillName} from './StudioFlow';
import {DmHead} from './StudioPlan';
import type {StoryEdition} from './types';
afterEach(cleanup);

const plan = (over: Partial<StoryEdition> = {}) => ({founderName: 'Hatim Abbas', message: 'Hi Alex, here is your guide.', flow: {messages: ['Hatim: Here is the guide.', 'Alex: Thanks.']}, ...over}) as unknown as StoryEdition;

describe('nameless example reader', () => {
 it('readerName is empty for role-style editions', () => expect(readerName(plan({readerStyle: 'role', flow: {messages: ['Hatim: Here is the guide.', 'Buyer: Thanks.']} as StoryEdition['flow']}))).toBe(''));
 it('still returns the conversation name for old editions', () => expect(readerName(plan())).toBe('Alex'));
 it('fillName with no name leaves the text unchanged', () => { expect(fillName('Hi, {first name} here.', '')).toBe('Hi, {first name} here.'); expect(fillName('Hi, saw the launch.', '')).toBe('Hi, saw the launch.'); });
 it('fillName with a name still fills', () => expect(fillName('Hi, saw it.', 'Alex')).toBe('Hi Alex, saw it.'));
 it('DmHead shows Example buyer and the role', () => {
  const {container} = render(<DmHead name="" role="Head of Growth"/>);
  expect(screen.getByText('Example buyer')).toBeTruthy();
  expect(screen.getByText('Head of Growth')).toBeTruthy();
  expect(container.querySelector('.sp-dm-avatar')!.textContent).not.toMatch(/undefined/);
 });
 it('DmHead with a name keeps the initial', () => {
  const {container} = render(<DmHead name="Janna" role="CMO"/>);
  expect(container.querySelector('.sp-dm-avatar')!.textContent).toBe('J');
 });
});
