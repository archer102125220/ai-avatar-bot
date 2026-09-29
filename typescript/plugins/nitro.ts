/**
 * @file Nitro server configuration generator for serving avatar-skin model assets.
 * @module plugins/nitro
 */

import { getAvatarSkinPath } from './node';
import type { AvatarBotPluginOptions } from './types';

export function createNitroAvatarConfig(options: AvatarBotPluginOptions = {}): {
  nitro: {
    publicAssets: Array<{ dir: string; baseURL: string; maxAge: number }>;
  };
} {
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
    typeof options?.maxAge === 'number'
      ? options.maxAge
      : 60 * 60 * 24 * 30; // 30 days

  return {
    nitro: {
      publicAssets: [
        {
          dir: assetsDir,
          baseURL: cleanRoute,
          maxAge
        }
      ]
    }
  };
}

export default {
  createNitroAvatarConfig
};
