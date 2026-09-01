/**
 * @template [T=Record<string, any>]
 * @typedef {Object} BaseStore
 * @property {() => T} getState - 取得目前的狀態。
 * @property {(updates: Partial<T> | ((state: T) => Partial<T>)) => void} setState - 更新狀態。
 * @property {(selector: ((state: T, previousState: T) => void) | keyof T | ((state: T) => any), callback?: (currentValue: any, previousValue: any) => void) => () => void} subscribe - 訂閱狀態變更。
 */

/**
 * 建立一個簡單且相容於 Vue / React 的狀態管理工具 (Store)。
 * 提供類似 Zustand 的狀態更新機制與特定屬性訂閱功能。
 *
 * @template [T=Record<string, any>]
 * @param {T} [initialState={}] - 初始狀態物件。
 * @returns {BaseStore<T>} 包含狀態操作方法的 Store 物件。
 */
export function createBaseStore(initialState = {}) {
  const state = { ...initialState };
  const subscribers = new Set();

  /**
   * 取得目前的狀態。
   *
   * @returns {T} 目前的狀態物件。
   */
  const getState = () => {
    return state;
  };

  /**
   * 更新狀態。
   * 支援直接傳入物件，或傳入一個接收前次狀態並回傳更新物件的函式。
   *
   * @param {Partial<T> | ((state: T) => Partial<T>)} updates - 欲更新的狀態物件或函式。
   */
  function setState(updates) {
    // 支援函式更新：setState((previousState) => ({ count: previousState.count + 1 }))
    const newValues = typeof updates === 'function' ? updates(state) : updates;

    let hasChanges = false;
    const previousState = { ...state };

    for (const key in newValues) {
      if (state[key] !== newValues[key]) {
        state[key] = newValues[key];
        hasChanges = true;
      }
    }

    // 只有在狀態確實改變時才發送通知
    if (hasChanges === true) {
      subscribers.forEach((listener) => {
        listener(state, previousState);
      });
    }
  }

  /**
   * 訂閱狀態變更。
   *
   * @example
   * // 用法 1：訂閱所有變更
   * subscribe((state, previousState) => console.log(state, previousState))
   * @example
   * // 用法 2：訂閱特定鍵值
   * subscribe('gender', (newGender, previousGender) => console.log(newGender, previousGender))
   * @example
   * // 用法 3：透過選取器函式訂閱
   * subscribe(state => state.gender, (newGender, previousGender) => console.log(newGender, previousGender))
   *
   * @param {((state: T, previousState: T) => void) | keyof T | ((state: T) => any)} selector - 監聽器函式、狀態鍵值字串，或狀態選取器函式。
   * @param {(currentValue: any, previousValue: any) => void} [callback] - 當特定狀態變更時觸發的回呼函式（適用於用法 2 與 3）。
   * @returns {() => void} 取消訂閱的函式。
   * @throws {Error} 當傳入無效的參數組合時拋出錯誤。
   */
  function subscribe(selector, callback) {
    let listener;

    // 用法 1：訂閱所有變更
    if (typeof selector === 'function' && typeof callback !== 'function') {
      listener = selector;
    }
    // 用法 2：訂閱特定字串鍵值
    else if (typeof selector === 'string' && typeof callback === 'function') {
      listener = function (currentState, previousState) {
        if (currentState[selector] !== previousState[selector]) {
          callback(currentState[selector], previousState[selector]);
        }
      };
    }
    // 用法 3：透過選取器函式訂閱特定值
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

    // 回傳取消訂閱的函式
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
