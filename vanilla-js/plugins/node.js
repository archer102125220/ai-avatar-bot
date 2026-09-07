import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * 取得 avatar-skin 靜態模型目錄的實體絕對路徑
 * @returns {string} avatar-skin 目錄之絕對路徑
 */
export function getAvatarSkinPath() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  // 1. 優先檢查相對於目前插件目錄的 avatar-skin
  const candidate1 = path.resolve(currentDir, '../avatar-skin');
  if (fs.existsSync(candidate1) === true && fs.statSync(candidate1).isDirectory() === true) {
    return candidate1;
  }

  // 2. 備用搜尋：若在打包發布後的嵌套結構中
  const candidate2 = path.resolve(currentDir, '../../avatar-skin');
  if (fs.existsSync(candidate2) === true && fs.statSync(candidate2).isDirectory() === true) {
    return candidate2;
  }

  return candidate1;
}

/**
 * 遞迴複製檔案或目錄
 * @param {string} src - 來源路徑
 * @param {string} dest - 目的路徑
 * @param {Object} [options={}] - 設定選項
 * @param {boolean} [options.overwrite=true] - 是否覆蓋現有檔案
 */
export function copyDirRecursive(src, dest, options = {}) {
  const overwrite = typeof options?.overwrite === 'boolean' ? options.overwrite : true;

  if (fs.existsSync(src) === false) {
    return;
  }

  if (fs.existsSync(dest) === false) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory() === true) {
      copyDirRecursive(srcPath, destPath, options);
    } else {
      if (overwrite === true || fs.existsSync(destPath) === false) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

/**
 * 複製 avatar-skin 靜態模型目錄至指定目標路徑
 * @param {string} targetDir - 目標目錄路徑（支援相對路徑與絕對路徑）
 * @param {Object} [options={}] - 設定選項
 * @param {boolean} [options.overwrite=true] - 是否覆蓋現有檔案
 * @returns {string} 最終寫入之目標目錄絕對路徑
 */
export function copyAvatarSkin(targetDir, options = {}) {
  if (typeof targetDir !== 'string' || targetDir.trim() === '') {
    throw new TypeError('[ai-avatar-bot] targetDir must be a non-empty string');
  }

  const srcDir = getAvatarSkinPath();
  const resolvedTarget = path.resolve(process.cwd(), targetDir);

  copyDirRecursive(srcDir, resolvedTarget, options);
  return resolvedTarget;
}

export default {
  getAvatarSkinPath,
  copyAvatarSkin,
  copyDirRecursive
};
