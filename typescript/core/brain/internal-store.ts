import { createBaseStore, type BaseStore } from '@/core/store';
import type { BrainStoreState } from './types';

/**
 * Module-private mapping between BrainEngine instances and their internal reactive state store.
 * Uses WeakMap so memory is reclaimed automatically when the BrainEngine instance is garbage-collected.
 */
const brainStoreMap = new WeakMap<object, BaseStore<BrainStoreState>>();

/**
 * Creates a reactive BaseStore instance initialized with default brain state.
 */
export function createBrainStore(): BaseStore<BrainStoreState> {
  return createBaseStore<BrainStoreState>({
    isSummarizing: false,
    companionFallbackIndex: 0,
    chatSeq: 0
  });
}

/**
 * Registers an internal BaseStore for a given BrainEngine instance.
 *
 * @param engine - The BrainEngine instance acting as the identity key.
 * @param store - The BaseStore holding the reactive internal state.
 */
export function registerBrainStore(
  engine: object,
  store: BaseStore<BrainStoreState>
): void {
  brainStoreMap.set(engine, store);
}

/**
 * Retrieves the internal BaseStore associated with a BrainEngine instance.
 *
 * @param engine - The BrainEngine instance or undefined/null.
 * @returns The reactive store if registered, or undefined.
 */
export function getBrainStore(
  engine: object | null | undefined
): BaseStore<BrainStoreState> | undefined {
  if (typeof engine !== 'object' || engine === null) {
    return undefined;
  }
  return brainStoreMap.get(engine);
}

/**
 * Retrieves a snapshot of the internal brain store state.
 * Returns safe defaults if no store is registered for the engine.
 *
 * @param engine - The BrainEngine instance.
 * @returns The current BrainStoreState snapshot.
 */
export function getBrainStoreState(
  engine: object | null | undefined
): BrainStoreState {
  const store = getBrainStore(engine);
  if (store === undefined) {
    return {
      isSummarizing: false,
      companionFallbackIndex: 0,
      chatSeq: 0
    };
  }
  return store.getState();
}

/**
 * Updates the internal reactive state for a BrainEngine instance.
 *
 * @param engine - The BrainEngine instance.
 * @param patch - Partial state updates or a updater function.
 */
export function setBrainStoreState(
  engine: object | null | undefined,
  patch:
    | Partial<BrainStoreState>
    | ((state: BrainStoreState) => Partial<BrainStoreState>)
): void {
  const store = getBrainStore(engine);
  if (store !== undefined) {
    store.setState(patch);
  }
}
