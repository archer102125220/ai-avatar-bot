/**
 * @file Nitro server engine helper generating `publicAssets` configurations for Nuxt 3, AnalogJS, and Nitro standalone.
 * @module plugins/nitro
 */

import { getAvatarSkinPath } from './node.js';

/**
 * Generates a Nitro server configuration object exposing bundled `avatar-skin` static assets (ESM).
 *
 * Applicable for:
 * - Nuxt 3 (`nuxt.config.ts` -> `nitro`)
 * - AnalogJS (`vite.config.ts` -> `analog({ nitro: ... })`)
 * - SolidStart / Nitro standalone server builds
 *
 * @param {import('../index.d.ts').AvatarBotPluginOptions} [options={}] - Nitro publicAssets configuration options.
 * @returns {{ publicAssets: Array<{ dir: string, baseURL: string, maxAge: number }> }} Nitro configuration snippet.
 */
export function createNitroAvatarConfig(options = {}) {
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
      : 60 * 60 * 24 * 30; // 30 days

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

export default createNitroAvatarConfig;

