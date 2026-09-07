const path = require('path');
const { getAvatarSkinPath } = require('./node.cjs');

/**
 * 產生 Nitro 伺服器引擎相容之 publicAssets 設定物件 (CommonJS)
 *
 * @param {Object} [options={}] - 設定選項
 * @param {string} [options.route='/avatar-skin'] - 模型虛擬路由（預設 '/avatar-skin'）
 * @param {string} [options.assetsDir] - 自訂靜態模型根目錄（預設為套件內部 avatar-skin）
 * @param {number} [options.maxAge=2592000] - HTTP 快取時間（秒）
 * @returns {{ publicAssets: Array<{ dir: string, baseURL: string, maxAge: number }> }}
 */
function createNitroAvatarConfig(options = {}) {
  const route =
    typeof options?.route === 'string' && options.route !== ''
      ? options.route
      : '/avatar-skin';
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;

  const assetsDir =
    typeof options?.assetsDir === 'string' && options.assetsDir !== ''
      ? options.assetsDir
      : getAvatarSkinPath();

  const maxAge =
    typeof options?.maxAge === 'number' && Number.isFinite(options.maxAge) === true
      ? options.maxAge
      : 60 * 60 * 24 * 30; // 30 天

  return {
    publicAssets: [
      {
        dir: assetsDir,
        baseURL: cleanRoute,
        maxAge
      }
    ]
  };
}

module.exports = {
  createNitroAvatarConfig,
  default: createNitroAvatarConfig
};
