/**
 * @file Next.js plugin wrapper for auto-syncing avatar-skin model assets with Turbopack and Webpack support.
 * @module plugins/next
 */

import path from 'path';
import fs from 'fs';
import { getAvatarSkinPath, copyDirRecursive } from './node.js';

/**
 * Internal helper to copy avatar-skin assets to the Next.js public directory.
 *
 * @param {Object} options - Sync options.
 * @param {string} options.targetDir - Destination physical directory path.
 * @param {string} options.assetsDir - Source physical directory path.
 * @param {boolean} options.silent - Whether to suppress console logging.
 * @returns {void}
 */
function syncAssets(options) {
  const { targetDir, assetsDir, silent } = options;
  try {
    if (fs.existsSync(assetsDir) === false) {
      if (silent === false) {
        console.warn(`[ai-avatar-bot/next] Source directory does not exist: ${assetsDir}`);
      }
      return;
    }

    copyDirRecursive(assetsDir, targetDir, { overwrite: true });

    if (silent === false) {
      console.log(`[ai-avatar-bot/next] Assets successfully synced to: ${targetDir}`);
    }
  } catch (err) {
    if (silent === false) {
      console.warn('[ai-avatar-bot/next] Failed to sync assets:', err);
    }
  }
}

/**
 * Enhances the Next.js configuration object with avatar-skin asset synchronization and webpack hooks.
 *
 * @param {Object} [baseConfig={}] - Original Next.js configuration object.
 * @param {import('../index.d.ts').AvatarBotPluginOptions} [options={}] - Plugin configuration options.
 * @returns {Object} Enhanced Next.js configuration object.
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
  // [Mechanism 1: Turbopack & Webpack common dev / build entry point]
  // ---------------------------------------------------------------------------
  // Sync assets directly to public/avatar-skin during next.config evaluation.
  // • Turbopack (next dev --turbo / next build --turbo):
  //   Turbopack does not execute webpack hooks and relies on files synced to public/ before compilation.
  // • Webpack (next dev):
  //   Dev server also reads statically from prepared public files.
  if (autoSync === true) {
    syncAssets({ targetDir, assetsDir, silent });
  }

  const originalWebpack = baseConfig.webpack;

  return {
    ...baseConfig,

    // -------------------------------------------------------------------------
    // [Mechanism 2: Webpack production build (next build / next export)]
    // -------------------------------------------------------------------------
    // When building production release with Webpack:
    // • Hook into client compilation as a secondary safeguard after CI/CD cleanups.
    // • When Turbopack is active, Next.js ignores this webpack function with zero side effects.
    webpack(config, context) {
      if (autoSync === true && context?.isServer === false && context?.dev === false) {
        syncAssets({ targetDir, assetsDir, silent: true });
      }

      // Preserve developer's custom webpack configuration in next.config.js
      if (typeof originalWebpack === 'function') {
        return originalWebpack(config, context);
      }

      return config;
    }
  };
}

/**
 * Next.js configuration enhancer higher-order function (ESM).
 *
 * Compatible with both Turbopack (Next.js 14 / 15+) and Webpack builders.
 *
 * @param {Object|Function} [nextConfig={}] - Original Next.js configuration object or async factory function.
 * @param {import('../index.d.ts').AvatarBotPluginOptions} [options={}] - Plugin configuration options.
 * @returns {Object|Function} Wrapped Next.js configuration.
 *
 * @example
 * ```javascript
 * import { withAiAvatarBot } from 'ai-avatar-bot-vanilla-js/plugins/next';
 *
 * export default withAiAvatarBot({
 *   reactStrictMode: true
 * });
 * ```
 */
export function withAiAvatarBot(nextConfig = {}, options = {}) {
  if (typeof nextConfig === 'function') {
    return async (phase, context) => {
      const resolvedConfig = await nextConfig(phase, context);
      return enhanceNextConfig(resolvedConfig, options);
    };
  }

  return enhanceNextConfig(nextConfig, options);
}

export default withAiAvatarBot;

