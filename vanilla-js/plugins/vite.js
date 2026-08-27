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
 * 取得檔案對應的 Content-Type
 * @param {string} filePath - 檔案路徑
 * @returns {string} MIME Type
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
 * 遞迴複製資料夾
 * @param {string} srcDir - 來源路徑
 * @param {string} destDir - 目的路徑
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
 * Vite 專屬離線與自動搬移插件
 *
 * @param {Object} [options={}] - 外掛設定選項
 * @param {string} [options.route='/avatar-skin'] - 欲攔截的虛擬路由（預設 '/avatar-skin'）
 * @param {string} [options.assetsDir] - 自訂靜態模型根目錄（預設為套件內部的 avatar-skin 目錄）
 * @returns {import('vite').Plugin} Vite Plugin 物件
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

          // 防止路徑遍歷攻擊
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
      // 在生產構建 (build) 結束時，自動複製 avatar-skin 到打包輸出目錄 (dist)
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
