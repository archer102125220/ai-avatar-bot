#!/usr/bin/env node
/**
 * @file smoke-test-assets.mjs
 * @description 模型資源完整度煙霧測試腳本 (Asset Integrity Smoke Test - 404 Guard)。
 *
 * 【核心用途】：
 * 1. 深度掃描 8 個範例專案在生產打包後的靜態資產目錄。
 * 2. 杜絕前端開發中最隱蔽的「打包建置成功，但模型資產遺失導致運行時 404 Not Found」問題。
 * 3. 逐一比對各框架不同的輸出結構（例如 Vite 的 `dist/`、Next.js 的 `public/`、Nuxt 的 `.output/public/`、Angular 的 `dist/.../browser/`），
 *    驗證 `avatar-skin` 包含 `2d-model`、`3d-model` 等資料夾，且檔案數量與大小皆大於零。
 *
 * 【使用方式 (CLI)】：
 *   node scripts/smoke-test-assets.mjs
 *   yarn test:smoke:assets
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 取得當前檔案路徑與專案根目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const examplesRoot = path.join(packageRoot, 'examples');

// 終端機 ANSI 顏色輸出設定
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m'
};

/**
 * 8 大範例專案之模型資源產物目標路徑清單
 * 註：各現代框架之 Production 產物結構各異，此處精確對應各自的 static public 目錄
 */
const ASSET_TARGETS = [
  {
    key: 'vanilla-ts',
    name: 'Vanilla TypeScript SPA',
    skinDir: path.join(examplesRoot, 'vanilla-ts', 'dist', 'avatar-skin')
  },
  {
    key: 'vanilla-js',
    name: 'Vanilla Pure JavaScript SPA',
    skinDir: path.join(examplesRoot, 'vanilla-js', 'dist', 'avatar-skin')
  },
  {
    key: 'react-direct',
    name: 'React 19 Client SPA',
    skinDir: path.join(examplesRoot, 'react-direct', 'dist', 'avatar-skin')
  },
  {
    key: 'vue-direct',
    name: 'Vue 3 SFC Client SPA',
    skinDir: path.join(examplesRoot, 'vue-direct', 'dist', 'avatar-skin')
  },
  {
    key: 'next-direct',
    name: 'Next.js 15 App Router Fullstack',
    skinDir: path.join(examplesRoot, 'next-direct', 'public', 'avatar-skin')
  },
  {
    key: 'nuxt-direct',
    name: 'Nuxt 3 Nitro Fullstack',
    skinDir: path.join(examplesRoot, 'nuxt-direct', '.output', 'public', 'avatar-skin')
  },
  {
    key: 'angular-direct',
    name: 'Angular 19 Standalone SPA',
    skinDir: path.join(examplesRoot, 'angular-direct', 'dist', 'example-angular-direct', 'browser', 'avatar-skin')
  },
  {
    key: 'analog-direct',
    name: 'Analog.js on Vite+Nitro Fullstack',
    skinDir: path.join(examplesRoot, 'analog-direct', 'dist', 'analog', 'public', 'avatar-skin')
  }
];

/**
 * 遞迴掃描指定目錄，計算內部檔案總數與總檔案大小
 * @param {string} dir - 要掃描的目錄路徑
 * @returns {{ fileCount: number, totalBytes: number }} 檔案數量與總位元組數
 */
function scanDirectoryRecursively(dir) {
  let fileCount = 0;
  let totalBytes = 0;

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        fileCount += 1;
        totalBytes += fs.statSync(fullPath).size;
      }
    }
  }

  walk(dir);
  return { fileCount, totalBytes };
}

/**
 * 驗證指定目標的模型資源目錄完整性
 * 檢查點包含：
 * 1. 目錄是否存在
 * 2. 2d-model 目錄是否存在
 * 3. 3d-model 目錄是否存在
 * 4. 檔案總數與大小是否非空
 * 
 * @param {object} target - ASSET_TARGETS 陣列中的項目
 * @returns {{ success: boolean, reason?: string, fileCount?: number, totalMB?: string }} 驗證報告
 */
function verifyAssets(target) {
  const { skinDir, name } = target;
  
  // 檢查 avatar-skin 根目錄
  if (!fs.existsSync(skinDir)) {
    return {
      success: false,
      reason: `avatar-skin directory NOT found at: ${path.relative(packageRoot, skinDir)}`
    };
  }

  const model2dDir = path.join(skinDir, '2d-model');
  const model3dDir = path.join(skinDir, '3d-model');

  // 檢查 2D 與 3D 模型子目錄是否存在
  if (!fs.existsSync(model2dDir)) {
    return { success: false, reason: `2d-model directory missing in ${path.relative(packageRoot, skinDir)}` };
  }
  if (!fs.existsSync(model3dDir)) {
    return { success: false, reason: `3d-model directory missing in ${path.relative(packageRoot, skinDir)}` };
  }

  // 檢查檔案是否真實存在且具備內容體積 (防止空目錄假通過)
  const stats = scanDirectoryRecursively(skinDir);
  if (stats.fileCount === 0 || stats.totalBytes === 0) {
    return { success: false, reason: `avatar-skin is empty (0 files) in ${path.relative(packageRoot, skinDir)}` };
  }

  return {
    success: true,
    fileCount: stats.fileCount,
    totalMB: (stats.totalBytes / (1024 * 1024)).toFixed(2)
  };
}

/**
 * 主程式入口函式
 */
function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}         Asset Integrity & Production Output Smoke Test (404 Guard)    ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let allPassed = true;
  const results = [];

  // 執行全部 8 個專案的資產煙霧檢測
  for (const target of ASSET_TARGETS) {
    const res = verifyAssets(target);
    results.push({ ...target, ...res });
    if (res.success === false) {
      allPassed = false;
    }
  }

  // 印出各專案檢測結果細項
  for (const item of results) {
    const namePadded = item.name.padEnd(36);
    if (item.success === true) {
      const statsText = `${item.fileCount} files, ${item.totalMB} MB`.padStart(20);
      console.log(`  ${colors.green}✓${colors.reset} ${namePadded} : ${colors.green}INTEGRITY OK${colors.reset} (${statsText})`);
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${namePadded} : ${colors.red}FAILED${colors.reset} - ${item.reason}`);
    }
  }

  console.log(`\n${colors.bold}========================================================================${colors.reset}`);

  // 若全部通過則 exit code 0，若有任一項目缺失模型資產則回傳 code 1
  if (allPassed === true) {
    console.log(`${colors.bold}${colors.green}All 8 applications have 100% intact avatar-skin assets in production outputs!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.bold}${colors.red}Asset smoke test failed! Missing static model assets detected.${colors.reset}\n`);
    process.exit(1);
  }
}

// 啟動執行
main();
