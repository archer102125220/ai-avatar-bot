/**
 * @file Nitro server engine helper generating `publicAssets` configurations for Nuxt 3, AnalogJS, and Nitro standalone (CommonJS).
 * @module plugins/nitro
 */

const { getAvatarSkinPath } = require('./node.cjs');

/**
 * Generates a Nitro server configuration object exposing bundled `avatar-skin` static assets (CommonJS).
 *
 * @param {import('@types').AvatarBotPluginOptions} [options={}] - Nitro publicAssets configuration options.
 * @returns {{ publicAssets: Array<{ dir: string, baseURL: string, maxAge: number }> }} Nitro configuration snippet.
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

module.exports = {
  createNitroAvatarConfig,
  default: createNitroAvatarConfig
};

