export interface TourState {
  active: boolean;
  index: number;
}

export type TourAction =
  | { type: 'START'; total: number }
  | { type: 'NEXT'; total: number }
  | { type: 'BACK' }
  | { type: 'GOTO'; index: number; total: number }
  | { type: 'END' };

export const initialTourState: TourState = { active: false, index: 0 };

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START': return { active: true, index: 0 };
    case 'NEXT':  return { active: true, index: Math.min(state.index + 1, action.total - 1) };
    case 'BACK':  return { active: true, index: Math.max(state.index - 1, 0) };
    case 'GOTO':  return { active: true, index: Math.max(0, Math.min(action.index, action.total - 1)) };
    case 'END':   return { active: false, index: 0 };
    default:      return state;
  }
}
