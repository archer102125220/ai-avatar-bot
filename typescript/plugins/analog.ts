/**
 * @file Analog.js plugin wrapper for serving avatar-skin model assets via Vite dev server and Nitro output.
 * @module plugins/analog
 */

import type { Plugin } from 'vite';
import { avatarBotVitePlugin } from './vite';
import { getAvatarSkinPath } from './node';
import type { AvatarBotPluginOptions } from './types';

export function getAnalogNitroConfig(options: AvatarBotPluginOptions = {}): { publicAssets: Array<{ dir: string; baseURL: string; maxAge: number }> } {
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
    publicAssets: [
      {
        dir: assetsDir,
        baseURL: cleanRoute,
        maxAge
      }
    ]
  };
}

export function avatarBotAnalogPlugin(options: AvatarBotPluginOptions = {}): Plugin {
  return avatarBotVitePlugin(options);
}

export default {
  avatarBotAnalogPlugin,
  getAnalogNitroConfig
};
