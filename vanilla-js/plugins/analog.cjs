const path = require('path');
const fs = require('fs');
const { getAvatarSkinPath, copyDirRecursive } = require('./node.cjs');
const { createNitroAvatarConfig } = require('./nitro.cjs');

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
 * AnalogJS 專用 Vite 插件 (CommonJS)
 *
 * @param {Object} [options={}] - 設定選項
 * @param {string} [options.route='/avatar-skin'] - 模型虛擬路由（預設 '/avatar-skin'）
 * @param {string} [options.assetsDir] - 自訂靜態模型根目錄（預設為套件內部 avatar-skin）
 * @returns {any} Vite Plugin 物件
 */
function avatarBotAnalogPlugin(options = {}) {
  const route =
    typeof options?.route === 'string' && options.route !== ''
      ? options.route
      : '/avatar-skin';
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;

  const assetsDir =
    typeof options?.assetsDir === 'string' && options.assetsDir !== ''
      ? options.assetsDir
      : getAvatarSkinPath();

  let viteConfig = null;

  return {
    name: 'vite-plugin-analog-ai-avatar-bot',

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

          if (fs.existsSync(filePath) === true && fs.statSync(filePath).isFile() === true) {
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
      if (viteConfig?.build && viteConfig?.command === 'build') {
        const root = viteConfig.root || process.cwd();
        const candidateOutDirs = [
          path.resolve(root, 'dist/analog/public'),
          path.resolve(root, '.output/public'),
          path.resolve(root, viteConfig.build.outDir || 'dist')
        ];

        const relativeRoute = cleanRoute.replace(/^[/\\]+/, '');

        for (const outDir of candidateOutDirs) {
          const targetDir = path.join(outDir, relativeRoute);
          try {
            copyDirRecursive(assetsDir, targetDir, { overwrite: true });
            console.log(`[ai-avatar-bot/analog] Assets copied to ${targetDir}`);
          } catch (_err) {
            // 忽略非目標目錄的複製錯誤
          }
        }
      }
    }
  };
}

const getAnalogNitroConfig = createNitroAvatarConfig;

module.exports = {
  avatarBotAnalogPlugin,
  getAnalogNitroConfig,
  default: avatarBotAnalogPlugin
};
