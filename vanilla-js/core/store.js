/**
 * @template [T=Record<string, any>]
 * @typedef {import('@types').BaseStore<T>} BaseStore
 */

/**
 * Creates a lightweight reactive state management store compatible with Vue, React, and Vanilla JS.
 * Provides a Zustand-like state update mechanism and property-specific subscriptions.
 *
 * @template [T=Record<string, any>]
 * @param {T} [initialState={}] - Initial state object.
 * @returns {BaseStore<T>} Store instance containing getState, setState, and subscribe methods.
 */
export function createBaseStore(initialState = {}) {
  const state = { ...initialState };
  const subscribers = new Set();

  /**
   * Retrieves the current snapshot of the store's state.
   *
   * @returns {T} Current state snapshot.
   */
  const getState = () => {
    return state;
  };

  /**
   * Updates store state and notifies relevant subscribers if any values changed.
   * Supports direct partial objects or updater functions receiving the previous state.
   *
   * @param {Partial<T> | ((state: T) => Partial<T>)} updates - Partial state object or updater function.
   */
  function setState(updates) {
    // Support updater function: setState((previousState) => ({ count: previousState.count + 1 }))
    const newValues = typeof updates === 'function' ? updates(state) : updates;

    let hasChanges = false;
    const previousState = { ...state };

    for (const key in newValues) {
      if (state[key] !== newValues[key]) {
        state[key] = newValues[key];
        hasChanges = true;
      }
    }

    // Notify subscribers only when state values actually change
    if (hasChanges === true) {
      subscribers.forEach((listener) => {
        listener(state, previousState);
      });
    }
  }

  /**
   * Subscribes to store state mutations.
   *
   * @example
   * // Pattern 1: Subscribe to all state mutations
   * subscribe((state, previousState) => console.log(state, previousState))
   * @example
   * // Pattern 2: Subscribe to a specific key
   * subscribe('gender', (newGender, previousGender) => console.log(newGender, previousGender))
   * @example
   * // Pattern 3: Subscribe via selector function
   * subscribe(state => state.gender, (newGender, previousGender) => console.log(newGender, previousGender))
   *
   * @param {((state: T, previousState: T) => void) | keyof T | ((state: T) => any)} selector - Listener callback, state property key, or selector function.
   * @param {(currentValue: any, previousValue: any) => void} [callback] - Callback triggered when the selected property changes (Patterns 2 and 3).
   * @returns {() => void} Unsubscribe function.
   * @throws {Error} If invalid argument combinations are provided.
   */
  function subscribe(selector, callback) {
    let listener;

    // Pattern 1: Subscribe to all state mutations
    if (typeof selector === 'function' && typeof callback !== 'function') {
      listener = selector;
    }
    // Pattern 2: Subscribe to a specific string key
    else if (typeof selector === 'string' && typeof callback === 'function') {
      listener = function (currentState, previousState) {
        if (currentState[selector] !== previousState[selector]) {
          callback(currentState[selector], previousState[selector]);
        }
      };
    }
    // Pattern 3: Subscribe to a specific property via selector function
    else if (typeof selector === 'function' && typeof callback === 'function') {
      listener = function (currentState, previousState) {
        const currentValue = selector(currentState);
        const previousValue = selector(previousState);
        if (currentValue !== previousValue) {
          callback(currentValue, previousValue);
        }
      };
    } else {
      throw new Error('Invalid subscribe arguments');
    }

    subscribers.add(listener);

    // Return unsubscribe callback
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
