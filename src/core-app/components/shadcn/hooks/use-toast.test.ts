import { describe, expect, it } from 'vitest';
import { reducer } from './use-toast';

type State = Parameters<typeof reducer>[0];
type Toast = State['toasts'][number];

const toast = (id: string, variant?: Toast['variant']): Toast =>
  ({ id, title: id, variant, open: true }) as Toast;

const add = (state: State, t: Toast): State =>
  reducer(state, { type: 'ADD_TOAST', toast: t });

const ids = (state: State) => state.toasts.map((t) => t.id);

describe('toast reducer — stacking', () => {
  it('stacks two toasts of the same type', () => {
    let state: State = { toasts: [] };
    state = add(state, toast('a'));
    state = add(state, toast('b'));
    expect(ids(state)).toEqual(['b', 'a']);
  });

  it('keeps only the two newest of the same type', () => {
    let state: State = { toasts: [] };
    state = add(state, toast('a'));
    state = add(state, toast('b'));
    state = add(state, toast('c'));
    expect(ids(state)).toEqual(['c', 'b']);
  });

  it('does not let one type push out another', () => {
    let state: State = { toasts: [] };
    state = add(state, toast('err1', 'destructive'));
    state = add(state, toast('a'));
    state = add(state, toast('b'));
    state = add(state, toast('c'));
    expect(ids(state)).toContain('err1');
    expect(ids(state).filter((id) => id !== 'err1')).toEqual(['c', 'b']);
  });

  it('treats a toast with no variant as default', () => {
    let state: State = { toasts: [] };
    state = add(state, toast('a', 'default'));
    state = add(state, toast('b'));
    state = add(state, toast('c', 'default'));
    expect(ids(state)).toEqual(['c', 'b']);
  });
});
