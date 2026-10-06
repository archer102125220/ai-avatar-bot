/**
 * @file Webpack plugin for serving avatar-skin 2D/3D model assets via devServer middleware and copying on build emission.
 * @module plugins/webpack
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { AvatarBotPluginOptions } from './types';
import { copyDirRecursive } from './node';

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

interface WebpackCompiler {
  hooks?: {
    thisCompilation?: {
      tap: (name: string, callback: (compilation: unknown) => void) => void;
    };
  };
  options?: {
    devServer?: {
      setupMiddlewares?: (middlewares: unknown[], devServer: { app: { use: (handler: unknown) => void } }) => unknown[];
    };
    output?: {
      path?: string;
    };
  };
}

interface WebpackRequest {
  url?: string;
}

interface WebpackResponse {
  statusCode: number;
  end: (content?: string) => void;
  setHeader: (key: string, headerValue: string) => void;
}

export class AvatarBotWebpackPlugin {
  private cleanRoute: string;
  private assetsDir: string;
  private autoSync: boolean;

  constructor(options: AvatarBotPluginOptions = {}) {
    const route = typeof options?.route === 'string' && options.route !== '' ? options.route : '/avatar-skin';
    this.cleanRoute = route.startsWith('/') ? route : `/${route}`;

    const currentDir =
      typeof __dirname !== 'undefined'
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));
    this.assetsDir =
      typeof options?.assetsDir === 'string' && options.assetsDir !== ''
        ? options.assetsDir
        : path.resolve(currentDir, '../avatar-skin');

    this.autoSync = typeof options?.autoSync === 'boolean' ? options.autoSync : true;
  }

  apply(compiler: WebpackCompiler): void {
    // 1. DevServer Middleware Interception
    if (compiler.options?.devServer) {
      const originalSetupMiddlewares = compiler.options.devServer.setupMiddlewares;
      compiler.options.devServer.setupMiddlewares = (middlewares, devServer) => {
        devServer.app.use((request: WebpackRequest, response: WebpackResponse, next: () => void) => {
          const url = request?.url || '';
          const pathname = decodeURIComponent(url.split('?')[0]);

          if (pathname.startsWith(this.cleanRoute)) {
            const relativePath = pathname.slice(this.cleanRoute.length).replace(/^[/\\]+/, '');
            const filePath = path.resolve(this.assetsDir, relativePath);

            if (filePath.startsWith(path.resolve(this.assetsDir)) === false) {
              response.statusCode = 403;
              return response.end('Forbidden');
            }

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() === true) {
              const mimeType = getMimeType(filePath);
              response.setHeader('Content-Type', mimeType);
              response.setHeader('Cache-Control', 'no-cache');
              return fs.createReadStream(filePath).pipe(response as unknown as NodeJS.WritableStream);
            }
          }
          next();
        });

        if (typeof originalSetupMiddlewares === 'function') {
          return originalSetupMiddlewares(middlewares, devServer);
        }
        return middlewares;
      };
    }

    // 2. Production Asset Emission
    if (this.autoSync === true && compiler.hooks?.thisCompilation) {
      compiler.hooks.thisCompilation.tap('AvatarBotWebpackPlugin', () => {
        const outputPath = compiler.options?.output?.path || path.resolve(process.cwd(), 'dist');
        const targetDir = path.join(outputPath, this.cleanRoute.replace(/^[/\\]+/, ''));
        try {
          copyDirRecursive(this.assetsDir, targetDir);
          console.log(`[ai-avatar-bot/webpack] Assets successfully synced to: ${targetDir}`);
        } catch (error) {
          console.warn('[ai-avatar-bot/webpack] Failed to copy avatar assets during build:', error);
        }
      });
    }
  }
}

export default AvatarBotWebpackPlugin;
