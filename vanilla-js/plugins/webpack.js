/**
 * @file Webpack plugin for serving avatar-skin 2D/3D model assets via devServer middleware and copying on build emission.
 * @module plugins/webpack
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
 * Webpack plugin for serving and bundling avatar-skin static assets.
 */
export class AvatarBotWebpackPlugin {
  /**
   * Initializes a new AvatarBotWebpackPlugin instance.
   *
   * @param {import('../index.d.ts').AvatarBotPluginOptions} [options={}] - Plugin configuration options.
   */
  constructor(options = {}) {
    this.route =
      typeof options?.route === 'string' && options.route !== ''
        ? options.route
        : '/avatar-skin';
    this.cleanRoute = this.route.startsWith('/') ? this.route : `/${this.route}`;

    const currentDir =
      typeof __dirname !== 'undefined'
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));
    this.assetsDir =
      typeof options?.assetsDir === 'string' && options.assetsDir !== ''
        ? options.assetsDir
        : path.resolve(currentDir, '../avatar-skin');
  }

  /**
   * Webpack plugin lifecycle apply method.
   *
   * @param {any} compiler - Webpack compiler instance.
   * @returns {void}
   */
  apply(compiler) {
    const cleanRoute = this.cleanRoute;
    const assetsDir = this.assetsDir;

    // 1. Development: Mount DevServer middleware to intercept avatar-skin routes
    const middleware = (req, res, next) => {
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
    };

    if (compiler?.options?.devServer) {
      const originalSetupMiddlewares = compiler.options.devServer.setupMiddlewares;
      compiler.options.devServer.setupMiddlewares = (middlewares, devServer) => {
        devServer.app.use(middleware);
        if (typeof originalSetupMiddlewares === 'function') {
          return originalSetupMiddlewares(middlewares, devServer);
        }
        return middlewares;
      };
    }

    // 2. Production build: Copy assets into Webpack output directory on afterEmit hook
    compiler.hooks.afterEmit.tapAsync('AvatarBotWebpackPlugin', (compilation, callback) => {
      const outputPath = compiler.options.output?.path || path.resolve(process.cwd(), 'dist');
      const targetDir = path.join(outputPath, cleanRoute.replace(/^[/\\]+/, ''));
      try {
        copyDirRecursive(assetsDir, targetDir);
        console.log(`[ai-avatar-bot] Webpack: Assets copied to ${targetDir}`);
      } catch (err) {
        console.warn('[ai-avatar-bot] Webpack: Failed to copy assets during build:', err);
      }
      callback();
    });
  }
}

export default AvatarBotWebpackPlugin;

