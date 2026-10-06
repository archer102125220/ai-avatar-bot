/**
 * @file Nuxt 3 module for serving avatar-skin model assets via Nitro server assets routing.
 * @module plugins/nuxt
 */

import { getAvatarSkinPath } from './node';
import type { AvatarBotPluginOptions } from './types';

interface NuxtInstance {
  options?: {
    nitro?: {
      publicAssets?: Array<{
        dir: string;
        baseURL: string;
        maxAge?: number;
      }>;
    };
  };
  hook?: (name: string, callback: (nitroConfig: unknown) => void) => void;
}

export function avatarBotNuxtModule(
  inlineOptions: AvatarBotPluginOptions = {},
  nuxt?: NuxtInstance
): void {
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
    typeof inlineOptions?.maxAge === 'number'
      ? inlineOptions.maxAge
      : 60 * 60 * 24 * 30; // 30 days

  if (nuxt?.options) {
    nuxt.options.nitro = nuxt.options.nitro || {};
    nuxt.options.nitro.publicAssets = nuxt.options.nitro.publicAssets || [];

    nuxt.options.nitro.publicAssets.push({
      dir: assetsDir,
      baseURL: cleanRoute,
      maxAge
    });
  } else if (typeof nuxt?.hook === 'function') {
    nuxt.hook('nitro:config', (nitroConfig: unknown) => {
      const targetNitroConfig = nitroConfig as { publicAssets?: Array<{ dir: string; baseURL: string; maxAge: number }> };
      if (targetNitroConfig) {
        targetNitroConfig.publicAssets = targetNitroConfig.publicAssets || [];
        targetNitroConfig.publicAssets.push({
          dir: assetsDir,
          baseURL: cleanRoute,
          maxAge
        });
      }
    });
  }
}

avatarBotNuxtModule.meta = {
  name: 'ai-avatar-bot-typescript/nuxt',
  configKey: 'avatarBot',
  compatibility: {
    nuxt: '>=3.0.0'
  }
};

export default avatarBotNuxtModule;
