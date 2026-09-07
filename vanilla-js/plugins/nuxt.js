import { getAvatarSkinPath } from './node.js';

/**
 * Nuxt 3 專用模組 (ESM)
 *
 * 【核心機制】
 * 透過監聽 Nuxt / Nitro 的 `nitro:config` 生命週期鉤子，將 avatar-skin 目錄註冊為 Nitro 的 publicAssets。
 * • 本地開發 (nuxt dev)：Nitro 直接由 node_modules 串流服務 /avatar-skin/*，0 磁碟複製、秒級啟動。
 * • 生產打包 (nuxt build / nuxt generate)：Nitro 自動將資產複製至 .output/public/avatar-skin/，相容所有部屬環境。
 *
 * @param {Object} [inlineOptions={}] - 模組設定選項
 * @param {string} [inlineOptions.route='/avatar-skin'] - 模型虛擬路由（預設 '/avatar-skin'）
 * @param {string} [inlineOptions.assetsDir] - 自訂靜態模型根目錄（預設為套件內部 avatar-skin）
 * @param {number} [inlineOptions.maxAge=2592000] - HTTP Cache-Control 快取時間 (秒，預設 30 天)
 * @param {any} [nuxt] - Nuxt 實例（由 Nuxt 運行時注入）
 */
export function avatarBotNuxtModule(inlineOptions = {}, nuxtApp) {
  const nuxt = nuxtApp || (typeof this !== 'undefined' ? this?.nuxt : null);

  const route =
    typeof inlineOptions?.route === 'string' && inlineOptions.route !== ''
      ? inlineOptions.route
      : '/avatar-skin';
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;

  const assetsDir =
    typeof inlineOptions?.assetsDir === 'string' && inlineOptions.assetsDir !== ''
      ? inlineOptions.assetsDir
      : getAvatarSkinPath();

  const maxAge =
    typeof inlineOptions?.maxAge === 'number' && Number.isFinite(inlineOptions.maxAge) === true
      ? inlineOptions.maxAge
      : 60 * 60 * 24 * 30; // 30 天

  if (nuxt?.hook) {
    nuxt.hook('nitro:config', (nitroConfig) => {
      if (typeof nitroConfig === 'object' && nitroConfig !== null) {
        if (Array.isArray(nitroConfig.publicAssets) === false) {
          nitroConfig.publicAssets = [];
        }

        nitroConfig.publicAssets.push({
          dir: assetsDir,
          baseURL: cleanRoute,
          maxAge
        });
      }
    });
  }
}

avatarBotNuxtModule.meta = {
  name: 'ai-avatar-bot-vanilla-js/nuxt',
  configKey: 'avatarBot',
  compatibility: {
    nuxt: '>=3.0.0'
  }
};

export default avatarBotNuxtModule;
