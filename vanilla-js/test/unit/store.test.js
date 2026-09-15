import { describe, it, expect, vi } from 'vitest';
import { createBaseStore } from '../../core/store';

describe('Unit Test: core/store.js', () => {
  it('should initialize with provided initialState', () => {
    const store = createBaseStore({
      count: 0,
      gender: 'female',
      active: true
    });

    const state = store.getState();
    expect(state).toEqual({
      count: 0,
      gender: 'female',
      active: true
    });
  });

  it('should initialize with empty object if no initialState is given', () => {
    const store = createBaseStore();
    expect(store.getState()).toEqual({});
  });

  it('should update state with plain object', () => {
    const store = createBaseStore({ count: 1, name: 'avatar' });
    store.setState({ count: 2 });

    expect(store.getState()).toEqual({
      count: 2,
      name: 'avatar'
    });
  });

  it('should update state using updater function', () => {
    const store = createBaseStore({ count: 10 });
    store.setState((prev) => ({ count: prev.count + 5 }));

    expect(store.getState().count).toBe(15);
  });

  it('should notify subscribers when state changes', () => {
    const store = createBaseStore({ status: 'idle' });
    const listener = vi.fn();

    store.subscribe(listener);
    store.setState({ status: 'loading' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      { status: 'loading' },
      { status: 'idle' }
    );
  });

  it('should NOT notify subscribers when values remain unchanged', () => {
    const store = createBaseStore({ count: 5 });
    const listener = vi.fn();

    store.subscribe(listener);
    store.setState({ count: 5 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should support subscribing to a specific property key (string selector)', () => {
    const store = createBaseStore({ gender: 'female', count: 0 });
    const genderListener = vi.fn();

    store.subscribe('gender', genderListener);

    // 更新其他屬性，不應觸發 genderListener
    store.setState({ count: 1 });
    expect(genderListener).not.toHaveBeenCalled();

    // 更新 gender 屬性，應觸發 genderListener
    store.setState({ gender: 'male' });
    expect(genderListener).toHaveBeenCalledTimes(1);
    expect(genderListener).toHaveBeenCalledWith('male', 'female');
  });

  it('should support subscribing with a custom selector function', () => {
    const store = createBaseStore({ user: { age: 18 } });
    const ageListener = vi.fn();

    store.subscribe((state) => state.user?.age, ageListener);

    store.setState({ user: { age: 19 } });
    expect(ageListener).toHaveBeenCalledTimes(1);
    expect(ageListener).toHaveBeenCalledWith(19, 18);
  });

  it('should properly unsubscribe when returned function is invoked', () => {
    const store = createBaseStore({ count: 0 });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1); // 保持為 1 次
  });

  it('should throw error when invalid arguments are passed to subscribe', () => {
    const store = createBaseStore();

    // @ts-expect-error Testing invalid arguments
    expect(() => store.subscribe(123)).toThrow('Invalid subscribe arguments');
    // @ts-expect-error Testing invalid arguments
    expect(() => store.subscribe('key', null)).toThrow('Invalid subscribe arguments');
  });
});
