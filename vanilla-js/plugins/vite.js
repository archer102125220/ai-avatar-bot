/**
 * @file Vite plugin for serving avatar-skin 2D/3D model assets during dev and auto-copying to dist on build.
 * @module plugins/vite
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const MIME_TYPES = {
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

/**
 * Resolves appropriate MIME content-type string for a given file path.
 *
 * @param {string} filePath - Target file path.
 * @returns {string} MIME content-type string.
 */
function getMimeType(filePath) {
  const lower = String(filePath || '').toLowerCase();
  for (const ext in MIME_TYPES) {
    if (lower.endsWith(ext)) {
      return MIME_TYPES[ext];
    }
  }
  return 'application/octet-stream';
}

/**
 * Recursively copies all files and directories from source to destination.
 *
 * @param {string} srcDir - Source directory path.
 * @param {string} destDir - Destination directory path.
 * @returns {void}
 */
function copyDirRecursive(srcDir, destDir) {
  if (fs.existsSync(srcDir) === false) {
    return;
  }
  if (fs.existsSync(destDir) === false) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory() === true) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Creates a Vite plugin that intercepts avatar-skin asset routes in dev server and copies assets during production build.
 *
 * @param {import('../index.d.ts').AvatarBotPluginOptions} [options={}] - Plugin configuration options.
 * @returns {import('vite').Plugin} Configured Vite plugin object.
 */
export function avatarBotVitePlugin(options = {}) {
  const route = typeof options?.route === 'string' && options.route !== '' ? options.route : '/avatar-skin';
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;

  const currentDir =
    typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  const assetsDir =
    typeof options?.assetsDir === 'string' && options.assetsDir !== ''
      ? options.assetsDir
      : path.resolve(currentDir, '../avatar-skin');

  let viteConfig = null;

  return {
    name: 'vite-plugin-ai-avatar-bot',

    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req?.url || '';
        const pathname = decodeURIComponent(url.split('?')[0]);

        if (pathname.startsWith(cleanRoute)) {
          const relativePath = pathname.slice(cleanRoute.length).replace(/^[/\\]+/, '');
          const filePath = path.resolve(assetsDir, relativePath);

          // Prevent path traversal attacks
          if (filePath.startsWith(path.resolve(assetsDir)) === false) {
            res.statusCode = 403;
            return res.end('Forbidden');
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() === true) {
            const mimeType = getMimeType(filePath);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'no-cache');
            return fs.createReadStream(filePath).pipe(res);
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
        } catch (err) {
          console.warn('[ai-avatar-bot] Failed to copy avatar assets during build:', err);
        }
      }
    }
  };
}

export default avatarBotVitePlugin;

