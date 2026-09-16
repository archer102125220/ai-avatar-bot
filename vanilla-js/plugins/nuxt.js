/**
 * @file Nuxt 3 module for registering avatar-skin assets into Nitro publicAssets pipeline.
 * @module plugins/nuxt
 */

import { getAvatarSkinPath } from './node.js';

/**
 * Nuxt 3 integration module (ESM).
 *
 * Hooks into Nuxt's `nitro:config` lifecycle to serve model files with zero disk copies in dev
 * and automatically bundles assets into `.output/public/avatar-skin/` during production build.
 *
 * @param {import('@types').AvatarBotPluginOptions} [inlineOptions={}] - Module options.
 * @param {any} [nuxtApp] - Nuxt runtime instance.
 * @returns {void}
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

export default avatarBotNuxtModule;

