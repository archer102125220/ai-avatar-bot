/**
 * @file Vite plugin for serving avatar-skin 2D/3D model assets during dev and auto-copying to dist on build.
 * @module plugins/vite
 */

import path from 'path';
import fs from 'fs';
import type { Plugin, ResolvedConfig } from 'vite';
import type { AvatarBotPluginOptions } from './types';
import { copyDirRecursive, getAvatarSkinPath } from './node';

const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.model3.json': 'application/json',
  '.physics3.json': 'application/json',
  '.pose3.json': 'application/json',
  '.cdi3.json': 'application/json',
  '.moc3': 'application/octet-stream',
  '.motion3.json': 'application/json',
  '.exp3.json': 'application/json',
  '.vrm': 'application/octet-stream',
  '.vrma': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function getMimeType(filePath: string): string {
  const lower = String(filePath || '').toLowerCase();
  for (const ext in MIME_TYPES) {
    if (lower.endsWith(ext)) {
      return MIME_TYPES[ext];
    }
  }
  return 'application/octet-stream';
}

/**
 * Creates a Vite plugin that intercepts avatar-skin asset routes in dev server and copies assets during production build.
 */
export function avatarBotVitePlugin(options: AvatarBotPluginOptions = {}): Plugin {
  const route = typeof options?.route === 'string' && options.route !== '' ? options.route : '/avatar-skin';
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;

  const assetsDir =
    typeof options?.assetsDir === 'string' && options.assetsDir !== ''
      ? options.assetsDir
      : getAvatarSkinPath();

  let viteConfig: ResolvedConfig | null = null;

  return {
    name: 'vite-plugin-ai-avatar-bot',

    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request?.url || '';
        const pathname = decodeURIComponent(url.split('?')[0]);

        if (pathname.startsWith(cleanRoute)) {
          const relativePath = pathname.slice(cleanRoute.length).replace(/^[/\\]+/, '');
          const filePath = path.resolve(assetsDir, relativePath);

          // Prevent path traversal attacks
          if (filePath.startsWith(path.resolve(assetsDir)) === false) {
            response.statusCode = 403;
            return response.end('Forbidden');
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() === true) {
            const mimeType = getMimeType(filePath);
            response.setHeader('Content-Type', mimeType);
            response.setHeader('Cache-Control', 'no-cache');
            return fs.createReadStream(filePath).pipe(response);
          }
        }
        next();
      });
    },

    closeBundle() {
      // Automatically copy avatar-skin assets to dist output directory during production build
      if (viteConfig?.build && viteConfig?.command === 'build') {
        const outDir = path.resolve(viteConfig.root || process.cwd(), viteConfig.build.outDir || 'dist');
        const targetDir = path.join(outDir, cleanRoute.replace(/^[/\\]+/, ''));
        try {
          copyDirRecursive(assetsDir, targetDir);
          console.log(`[ai-avatar-bot] Assets successfully copied to ${targetDir}`);
        } catch (error) {
          console.warn('[ai-avatar-bot] Failed to copy avatar assets during build:', error);
        }
      }
    }
  };
}

export default avatarBotVitePlugin;
