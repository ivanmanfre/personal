import { describe, it, expect } from 'vitest';
import { tourReducer, initialTourState, type TourState } from './tourReducer';

const N = 7;

describe('tourReducer', () => {
  it('starts inactive at index 0', () => {
    expect(initialTourState).toEqual({ active: false, index: 0 });
  });

  it('START activates at 0', () => {
    expect(tourReducer(initialTourState, { type: 'START', total: N })).toEqual({ active: true, index: 0 });
  });

  it('NEXT advances but clamps at last and never deactivates', () => {
    let s: TourState = { active: true, index: N - 2 };
    s = tourReducer(s, { type: 'NEXT', total: N });
    expect(s).toEqual({ active: true, index: N - 1 });
    s = tourReducer(s, { type: 'NEXT', total: N });
    expect(s).toEqual({ active: true, index: N - 1 });
  });

  it('BACK decrements but clamps at 0', () => {
    let s: TourState = { active: true, index: 1 };
    s = tourReducer(s, { type: 'BACK' });
    expect(s).toEqual({ active: true, index: 0 });
    s = tourReducer(s, { type: 'BACK' });
    expect(s).toEqual({ active: true, index: 0 });
  });

  it('END deactivates and resets index', () => {
    expect(tourReducer({ active: true, index: 4 }, { type: 'END' })).toEqual({ active: false, index: 0 });
  });
});
