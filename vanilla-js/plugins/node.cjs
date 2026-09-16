/**
 * @file Node.js asset resolution and recursive copy utilities for avatar-skin 2D/3D model assets (CommonJS).
 * @module plugins/node
 */

const path = require('path');
const fs = require('fs');

/**
 * Resolves the absolute physical filesystem path to the bundled `avatar-skin` directory (CommonJS).
 *
 * @returns {string} Absolute path to the avatar-skin directory.
 */
function getAvatarSkinPath() {
  // 1. Check relative to plugin directory
  const candidate1 = path.resolve(__dirname, '../avatar-skin');
  if (fs.existsSync(candidate1) === true && fs.statSync(candidate1).isDirectory() === true) {
    return candidate1;
  }

  // 2. Fallback search: nested distribution structure
  const candidate2 = path.resolve(__dirname, '../../avatar-skin');
  if (fs.existsSync(candidate2) === true && fs.statSync(candidate2).isDirectory() === true) {
    return candidate2;
  }

  return candidate1;
}

/**
 * Recursively copies files and subdirectories from source to destination.
 *
 * @param {string} src - Source filesystem directory path.
 * @param {string} dest - Destination filesystem directory path.
 * @param {Object} [options={}] - Copy options.
 * @param {boolean} [options.overwrite=true] - Whether to overwrite existing files at destination.
 * @returns {void}
 */
function copyDirRecursive(src, dest, options = {}) {
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
 * Copies bundled avatar-skin model files into a specified target directory (e.g. `public/avatar-skin`).
 *
 * @param {string} targetDir - Target directory path (relative or absolute).
 * @param {Object} [options={}] - Copy options.
 * @param {boolean} [options.overwrite=true] - Whether to overwrite existing destination files.
 * @returns {string} Absolute path to the resolved destination directory.
 */
function copyAvatarSkin(targetDir, options = {}) {
  if (typeof targetDir !== 'string' || targetDir.trim() === '') {
    throw new TypeError('[ai-avatar-bot] targetDir must be a non-empty string');
  }

  const srcDir = getAvatarSkinPath();
  const resolvedTarget = path.resolve(process.cwd(), targetDir);

  copyDirRecursive(srcDir, resolvedTarget, options);
  return resolvedTarget;
}

module.exports = {
  getAvatarSkinPath,
  copyAvatarSkin,
  copyDirRecursive,
  default: {
    getAvatarSkinPath,
    copyAvatarSkin,
    copyDirRecursive
  }
};

