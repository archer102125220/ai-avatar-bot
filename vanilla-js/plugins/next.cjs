const path = require('path');
const fs = require('fs');
const { getAvatarSkinPath, copyDirRecursive } = require('./node.cjs');

/**
 * 內部輔助函式：同步 avatar-skin 資產至 Next.js public 目錄
 * @param {Object} options - 外掛設定選項
 * @param {string} options.targetDir - 目標目錄實體路徑
 * @param {string} options.assetsDir - 來源目錄實體路徑
 * @param {boolean} options.silent - 是否靜音日誌輸出
 */
function syncAssets(options) {
  const { targetDir, assetsDir, silent } = options;
  try {
    if (fs.existsSync(assetsDir) === false) {
      if (silent === false) {
        console.warn(`[ai-avatar-bot/next] 來源目錄不存在: ${assetsDir}`);
      }
      return;
    }

    copyDirRecursive(assetsDir, targetDir, { overwrite: true });

    if (silent === false) {
      console.log(`[ai-avatar-bot/next] 資產已自動同步至: ${targetDir}`);
    }
  } catch (err) {
    if (silent === false) {
      console.warn('[ai-avatar-bot/next] 同步資產失敗:', err);
    }
  }
}

/**
 * 強化 Next.js 配置物件
 * @param {Object} baseConfig - 原始 Next.js 配置物件
 * @param {Object} [options={}] - 外掛設定選項
 * @returns {Object} 強化後的 Next.js 配置物件
 */
function enhanceNextConfig(baseConfig = {}, options = {}) {
  const route =
    typeof options?.route === 'string' && options.route !== ''
      ? options.route
      : '/avatar-skin';
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;
  const relativeRoute = cleanRoute.replace(/^[/\\]+/, '');

  const publicDirName =
    typeof options?.publicDir === 'string' && options.publicDir !== ''
      ? options.publicDir
      : 'public';

  const assetsDir =
    typeof options?.assetsDir === 'string' && options.assetsDir !== ''
      ? options.assetsDir
      : getAvatarSkinPath();

  const targetDir = path.resolve(process.cwd(), publicDirName, relativeRoute);
  const autoSync = typeof options?.autoSync === 'boolean' ? options.autoSync : true;
  const silent = typeof options?.silent === 'boolean' ? options.silent : false;

  // ---------------------------------------------------------------------------
  // [機制 1: 適用於 Turbopack 與 Webpack (Dev / Build 共同入口)]
  // ---------------------------------------------------------------------------
  // 在 next.config 評估階段直接將資產同步至 public/avatar-skin。
  // • Turbopack (next dev --turbo / next build --turbo):
  //   Turbopack 不執行 webpack 鉤子，完全依賴此處在編譯前同步到 public/ 目錄的實體檔案，
  //   由 Next.js 靜態檔案伺服器直接對外提供 /avatar-skin/* 服務。
  // • Webpack (next dev):
  //   開發伺服器亦透過此處提前就緒之 public 檔案進行即時載入。
  if (autoSync === true) {
    syncAssets({ targetDir, assetsDir, silent });
  }

  const originalWebpack = baseConfig.webpack;

  return {
    ...baseConfig,

    // -------------------------------------------------------------------------
    // [機制 2: 適用於 Webpack 生產構建 (next build / next export)]
    // -------------------------------------------------------------------------
    // 當專案使用 Webpack 構建正式發布版本時：
    // • 注入 Client 編譯完成鉤子，作為向後相容與 CI/CD 清理 public 後的二次保險。
    // • 當開發者啟用 Turbopack 時，Next.js 會自動忽略此 webpack 函式，無任何副作用。
    webpack(config, context) {
      if (autoSync === true && context?.isServer === false && context?.dev === false) {
        syncAssets({ targetDir, assetsDir, silent: true });
      }

      // 保留使用者原本在 next.config.js 中自訂的 webpack 設定
      if (typeof originalWebpack === 'function') {
        return originalWebpack(config, context);
      }

      return config;
    }
  };
}

/**
 * Next.js 專屬配置封裝器 (CommonJS)
 *
 * 【打包工具相容性說明】
 * 1. ⚡ Turbopack 支援 (Next.js 14 / 15+)：
 *    - 於 next.config 評估階段自動同步資產至 public/avatar-skin，Turbopack 啟動後直接對外服務。
 * 2. 🛡️ Webpack 支援 (傳統 Next.js 構建 / CI)：
 *    - 具備 Config 載入同步 + Webpack Client 構建雙重保障機制。
 *
 * @param {Object|Function} [nextConfig={}] - 使用者原本的 next.config.js 設定（支援物件或函式）
 * @param {Object} [options={}] - 外掛設定選項
 * @param {string} [options.route='/avatar-skin'] - 模型虛擬路由（預設 '/avatar-skin'）
 * @param {string} [options.publicDir='public'] - 專案的 public 靜態資產目錄名稱（預設 'public'）
 * @param {string} [options.assetsDir] - 自訂靜態模型根目錄（預設為套件內部 avatar-skin）
 * @param {boolean} [options.autoSync=true] - 是否在啟動與構建時自動同步資產至 public 目錄
 * @param {boolean} [options.silent=false] - 是否靜音日誌輸出
 * @returns {Object|Function} 包裝後的 Next.js 配置
 */
function withAiAvatarBot(nextConfig = {}, options = {}) {
  if (typeof nextConfig === 'function') {
    return async (phase, context) => {
      const resolvedConfig = await nextConfig(phase, context);
      return enhanceNextConfig(resolvedConfig, options);
    };
  }

  return enhanceNextConfig(nextConfig, options);
}

module.exports = {
  withAiAvatarBot,
  default: withAiAvatarBot
};
