/**
 * Generic listener function for all state mutations.
 */
export type StoreListener<T> = (state: T, previousState: T) => void;

/**
 * Generic listener callback for property/selector changes.
 */
export type PropertyListener<V> = (currentValue: V, previousValue: V) => void;

/**
 * Selector function extracting a slice of state.
 */
export type Selector<T, V> = (state: T) => V;

/**
 * Base reactive store interface compatible across Vanilla, Vue, and React.
 */
export interface BaseStore<T extends Record<string, any> = Record<string, any>> {
  /**
   * Retrieves the current snapshot of the store's state.
   */
  getState(): T;

  /**
   * Updates store state and notifies relevant subscribers if any values changed.
   */
  setState(updates: Partial<T> | ((state: T) => Partial<T>)): void;

  /**
   * Subscribes to all state mutations.
   */
  subscribe(listener: StoreListener<T>): () => void;

  /**
   * Subscribes to a specific key mutation.
   */
  subscribe<K extends keyof T>(key: K, callback: PropertyListener<T[K]>): () => void;

  /**
   * Subscribes via selector function.
   */
  subscribe<V>(selector: Selector<T, V>, callback: PropertyListener<V>): () => void;
}

/**
 * Creates a lightweight reactive state management store compatible with Vue, React, and Vanilla JS.
 * Provides a Zustand-like state update mechanism and property-specific subscriptions.
 *
 * @param initialState - Initial state object.
 * @returns Store instance containing getState, setState, and subscribe methods.
 */
export function createBaseStore<T extends Record<string, any> = Record<string, any>>(
  initialState: T = {} as T
): BaseStore<T> {
  const state: T = { ...initialState };
  const subscribers = new Set<StoreListener<T>>();

  const getState = (): T => {
    return state;
  };

  function setState(updates: Partial<T> | ((state: T) => Partial<T>)): void {
    const newValues =
      typeof updates === 'function' ? updates(state) : updates;

    let hasChanges = false;
    const previousState: T = { ...state };

    for (const key in newValues) {
      if (Object.prototype.hasOwnProperty.call(newValues, key)) {
        if (state[key] !== newValues[key]) {
          state[key] = newValues[key] as T[Extract<keyof T, string>];
          hasChanges = true;
        }
      }
    }

    if (hasChanges === true) {
      subscribers.forEach((listener) => {
        listener(state, previousState);
      });
    }
  }

  function subscribe(
    selector: StoreListener<T> | keyof T | Selector<T, any>,
    callback?: PropertyListener<any>
  ): () => void {
    let listener: StoreListener<T>;

    // Pattern 1: Subscribe to all state mutations
    if (typeof selector === 'function' && typeof callback !== 'function') {
      listener = selector as StoreListener<T>;
    }
    // Pattern 2: Subscribe to a specific string key
    else if (
      (typeof selector === 'string' || typeof selector === 'symbol') &&
      typeof callback === 'function'
    ) {
      const key = selector as keyof T;
      listener = function (currentState: T, previousState: T) {
        if (currentState[key] !== previousState[key]) {
          callback(currentState[key], previousState[key]);
        }
      };
    }
    // Pattern 3: Subscribe to a specific property via selector function
    else if (typeof selector === 'function' && typeof callback === 'function') {
      const fn = selector as Selector<T, any>;
      listener = function (currentState: T, previousState: T) {
        const currentValue = fn(currentState);
        const previousValue = fn(previousState);
        if (currentValue !== previousValue) {
          callback(currentValue, previousValue);
        }
      };
    } else {
      throw new Error('Invalid subscribe arguments');
    }

    subscribers.add(listener);

    return () => {
      subscribers.delete(listener);
    };
  }

  return {
    getState,
    setState,
    subscribe
  };
}
