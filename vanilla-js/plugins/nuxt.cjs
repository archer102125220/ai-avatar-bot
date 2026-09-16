/**
 * @file Nuxt 3 module for registering avatar-skin assets into Nitro publicAssets pipeline (CommonJS).
 * @module plugins/nuxt
 */

const { getAvatarSkinPath } = require('./node.cjs');

/**
 * Nuxt 3 integration module (CommonJS).
 *
 * @param {import('@types').AvatarBotPluginOptions} [inlineOptions={}] - Module options.
 * @param {any} [nuxtApp] - Nuxt runtime instance.
 * @returns {void}
 */
function avatarBotNuxtModule(inlineOptions = {}, nuxtApp) {
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
      : 60 * 60 * 24 * 30; // 30 days

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

module.exports = {
  avatarBotNuxtModule,
  default: avatarBotNuxtModule
};

