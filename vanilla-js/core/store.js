/**
 * A simple, Vue/React-friendly state management utility (Store).
 * Provides Zustand-like state updates and specific property subscriptions.
 */
export function createBaseStore(initialState = {}) {
  const state = { ...initialState };
  const subscribers = new Set();

  const getState = () => state;

  const setState = (updates) => {
    // Allows functional updates: setState(prev => ({ count: prev.count + 1 }))
    const newValues = typeof updates === 'function' ? updates(state) : updates;

    let hasChanges = false;
    const prevState = { ...state };

    for (const key in newValues) {
      if (state[key] !== newValues[key]) {
        state[key] = newValues[key];
        hasChanges = true;
      }
    }

    // Only notify if something actually changed
    if (hasChanges === true) {
      subscribers.forEach((listener) => {
        listener(state, prevState);
      });
    }
  };

  /**
   * Subscribe to state changes.
   * Usage 1: subscribe(state => console.log(state))
   * Usage 2: subscribe('gender', newGender => console.log(newGender))
   * Usage 3: subscribe(state => state.app.gender, newGender => ...)
   */
  const subscribe = (selector, cb) => {
    let listener;

    // Usage 1: Subscribe to all changes
    if (typeof selector === 'function' && typeof cb !== 'function') {
      listener = selector;
    }
    // Usage 2: Subscribe to a specific string key
    else if (typeof selector === 'string' && typeof cb === 'function') {
      listener = (currentState, prevState) => {
        if (currentState[selector] !== prevState[selector]) {
          cb(currentState[selector], prevState[selector]);
        }
      };
    }
    // Usage 3: Subscribe via a selector function
    else if (typeof selector === 'function' && typeof cb === 'function') {
      listener = (currentState, prevState) => {
        const currentVal = selector(currentState);
        const prevVal = selector(prevState);
        if (currentVal !== prevVal) {
          cb(currentVal, prevVal);
        }
      };
    } else {
      throw new Error('Invalid subscribe arguments');
    }

    subscribers.add(listener);

    // Return unsubscribe function
    return () => subscribers.delete(listener);
  };

  return {
    getState,
    setState,
    subscribe
  };
}
