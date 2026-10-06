/**
 * @file Next.js plugin wrapper for auto-syncing avatar-skin model assets with Turbopack and Webpack support.
 * @module plugins/next
 */

import path from 'path';
import fs from 'fs';
import { getAvatarSkinPath, copyDirRecursive } from './node';
import type { AvatarBotPluginOptions } from './types';

interface SyncAssetsOptions {
  targetDir: string;
  assetsDir: string;
  silent: boolean;
}

function syncAssets(options: SyncAssetsOptions): void {
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
  } catch (error) {
    if (silent === false) {
      console.warn('[ai-avatar-bot/next] Failed to sync assets:', error);
    }
  }
}

interface NextWebpackConfig {
  plugins?: unknown[];
}

interface NextConfigObject {
  webpack?: (config: NextWebpackConfig, context: unknown) => NextWebpackConfig;
  [key: string]: unknown;
}

/**
 * Enhances Next.js configuration object with avatar-skin asset synchronization and webpack hooks.
 */
function enhanceNextConfig(
  baseConfig: NextConfigObject = {},
  options: AvatarBotPluginOptions = {}
): NextConfigObject {
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

  // Turbopack & startup synchronous copy
  if (autoSync === true) {
    syncAssets({ targetDir, assetsDir, silent });
  }

  const originalWebpack = baseConfig.webpack;

  return {
    ...baseConfig,
    webpack(config: NextWebpackConfig, context: unknown) {
      if (autoSync === true) {
        syncAssets({ targetDir, assetsDir, silent });
      }

      if (typeof originalWebpack === 'function') {
        return originalWebpack(config, context);
      }
      return config;
    }
  };
}

export function withAiAvatarBot<T extends Record<string, unknown> = Record<string, unknown>>(
  nextConfig?: T | ((phase: string, defaultConfig: Record<string, unknown>) => T | Promise<T>),
  pluginOptions: AvatarBotPluginOptions = {}
): T | ((phase: string, defaultConfig: Record<string, unknown>) => Promise<T> | T) {
  if (typeof nextConfig === 'function') {
    return async (phase: string, defaultConfig: Record<string, unknown>): Promise<T> => {
      const resolvedConfig = await nextConfig(phase, defaultConfig);
      return enhanceNextConfig(resolvedConfig, pluginOptions) as T;
    };
  }

  return enhanceNextConfig((nextConfig || {}) as NextConfigObject, pluginOptions) as T;
}

export default withAiAvatarBot;
