import { describe, it, expect, vi } from 'vitest';
import {
  createBrainStore,
  registerBrainStore,
  getBrainStore,
  getBrainStoreState,
  setBrainStoreState
} from '@/core/brain/internal-store';

describe('Unit Test: core/brain/internal-store.ts (Internal Store Module)', () => {
  it('should create a reactive BaseStore with default brain state', () => {
    const store = createBrainStore();
    expect(store).toBeDefined();

    const state = store.getState();
    expect(state.isSummarizing).toBe(false);
    expect(state.companionFallbackIndex).toBe(0);
    expect(state.chatSeq).toBe(0);
  });

  it('should register and retrieve store for a given engine instance', () => {
    const fakeEngine = { id: 'engine-1' };
    const store = createBrainStore();

    registerBrainStore(fakeEngine, store);

    const retrievedStore = getBrainStore(fakeEngine);
    expect(retrievedStore).toBe(store);
  });

  it('should return undefined when retrieving store for unregistered or invalid engine', () => {
    const unregistered = { id: 'unregistered' };
    expect(getBrainStore(unregistered)).toBeUndefined();
    expect(getBrainStore(null)).toBeUndefined();
    expect(getBrainStore(undefined)).toBeUndefined();
  });

  it('should get snapshot of state or safe defaults when engine is not registered', () => {
    const engine = { id: 'engine-2' };
    const store = createBrainStore();
    store.setState({ isSummarizing: true, companionFallbackIndex: 2, chatSeq: 42 });
    registerBrainStore(engine, store);

    const state = getBrainStoreState(engine);
    expect(state.isSummarizing).toBe(true);
    expect(state.companionFallbackIndex).toBe(2);
    expect(state.chatSeq).toBe(42);

    const defaultState = getBrainStoreState(null);
    expect(defaultState).toEqual({
      isSummarizing: false,
      companionFallbackIndex: 0,
      chatSeq: 0
    });

    const unregisteredState = getBrainStoreState({ id: 'random' });
    expect(unregisteredState).toEqual({
      isSummarizing: false,
      companionFallbackIndex: 0,
      chatSeq: 0
    });
  });

  it('should update store state using partial object or updater function via setBrainStoreState', () => {
    const engine = { id: 'engine-3' };
    const store = createBrainStore();
    registerBrainStore(engine, store);

    setBrainStoreState(engine, { isSummarizing: true });
    expect(getBrainStoreState(engine).isSummarizing).toBe(true);

    setBrainStoreState(engine, (prev) => ({
      companionFallbackIndex: prev.companionFallbackIndex + 1,
      chatSeq: prev.chatSeq + 10
    }));

    const updated = getBrainStoreState(engine);
    expect(updated.companionFallbackIndex).toBe(1);
    expect(updated.chatSeq).toBe(10);
    expect(updated.isSummarizing).toBe(true);
  });

  it('should safely handle setBrainStoreState when engine is not registered or null', () => {
    expect(() => {
      setBrainStoreState(null, { isSummarizing: true });
      setBrainStoreState(undefined, { isSummarizing: true });
      setBrainStoreState({ id: 'no-store' }, { isSummarizing: true });
    }).not.toThrow();
  });

  it('should notify subscribers when store state changes via setBrainStoreState', () => {
    const engine = { id: 'engine-4' };
    const store = createBrainStore();
    registerBrainStore(engine, store);

    const listener = vi.fn();
    store.subscribe('isSummarizing', listener);

    setBrainStoreState(engine, { isSummarizing: true });
    expect(listener).toHaveBeenCalledWith(true, false);

    setBrainStoreState(engine, { isSummarizing: false });
    expect(listener).toHaveBeenCalledWith(false, true);
  });

  it('should maintain strict isolation between multiple engine instances', () => {
    const engineA = { id: 'engine-A' };
    const engineB = { id: 'engine-B' };

    const storeA = createBrainStore();
    const storeB = createBrainStore();

    registerBrainStore(engineA, storeA);
    registerBrainStore(engineB, storeB);

    setBrainStoreState(engineA, { chatSeq: 5 });
    setBrainStoreState(engineB, { chatSeq: 99 });

    expect(getBrainStoreState(engineA).chatSeq).toBe(5);
    expect(getBrainStoreState(engineB).chatSeq).toBe(99);
  });
});
