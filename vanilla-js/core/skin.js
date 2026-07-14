// skin.js
export const ENGINE_MODE_MAP = {
  twoDimensional: '2d',
  threeDimensional: '3d'
};
export const DEFALUT_START_MODE = ENGINE_MODE_MAP.twoDimensional;
// skin.js
export const FIT_MODE_MAP = {
  HALF: 'half',
  FULL: 'full'
};
// 取景：'half'=近距離半身（頭+上半身，腿裁掉，聊天頭像感）；'full'=全身。可用 ?fit=full / data-fit 切回
export const DEFAULT_FIT_MODE = FIT_MODE_MAP.HALF;

// live2d: https://www.live2d.com/zh-CHS/learn/sample/
// 3D: https://hub.vroid.com/en

// skin.js
// export const DEFAULT_MODEL_URL =
//   'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';
export const DEFAULT_FEMALE_MODEL_URL =
  '/avatar-skin/2d-model/female/haru_greeter_t03.model3.json';
export const DEFAULT_MALE_MODEL_URL =
  '/avatar-skin/2d-model/male/natori_pro_t06.model3.json';

export function initSkinEngine() {}
