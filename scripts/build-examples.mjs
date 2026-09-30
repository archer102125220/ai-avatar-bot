#!/usr/bin/env node
/**
 * @file build-examples.mjs
 * @description 範例專案全量生產環境建置執行器 (Examples Production Builder)。
 * 
 * 【核心用途】：
 * 1. 統一建置 monorepo 內 8 個範例專案（涵蓋 SPA、SSR、Fullstack 跨框架）。
 * 2. 解決 npm 本地快取痛點：自動將當前最新編譯的 SDK (`typescript/dist` 與 `avatar-skin`)
 *    熱同步至各範例的 `node_modules/ai-avatar-bot-typescript`，防止因版本號未更新而導致吃舊代碼。
 * 3. 作為 CI/CD 生產打包發布的第一道防線，確保零回歸 (Zero Regression)。
 *
 * 【使用方式 (CLI)】：
 *   node scripts/build-examples.mjs [target]
 *   yarn build:examples [target]
 * 
 * 【可選目標 target】：
 *   all (預設，建置全部 8 個) | vanilla-ts | vanilla-js | react | vue | next | nuxt | angular | analog
 *
 * 【範例】：
 *   yarn build:examples          # 建置所有範例
 *   yarn build:examples next     # 僅建置 Next.js 範例
 *   yarn build:examples angular  # 僅建置 Angular 範例
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
 * 8 大範例專案設定清單
 * @property {string} key - CLI 目標比對關鍵字
 * @property {string} name - 友善展示名稱
 * @property {string} dir - 位於 package/examples/ 下的資料夾名稱
 * @property {string} cmd - 建置執行的主命令 (通常為 npm)
 * @property {string[]} args - 建置參數 (通常為 ['run', 'build'])
 */
const EXAMPLES = [
  {
    key: 'vanilla-ts',
    name: 'Vanilla TypeScript SPA',
    dir: 'vanilla-ts',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'vanilla-js',
    name: 'Vanilla Pure JavaScript SPA',
    dir: 'vanilla-js',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'react-direct',
    name: 'React 19 Client SPA',
    dir: 'react-direct',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'vue-direct',
    name: 'Vue 3 SFC Client SPA',
    dir: 'vue-direct',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'next-direct',
    name: 'Next.js 15 App Router Fullstack',
    dir: 'next-direct',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'nuxt-direct',
    name: 'Nuxt 3 Nitro Fullstack',
    dir: 'nuxt-direct',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'angular-direct',
    name: 'Angular 19 Standalone SPA',
    dir: 'angular-direct',
    cmd: 'npm',
    args: ['run', 'build']
  },
  {
    key: 'analog-direct',
    name: 'Analog.js on Vite+Nitro Fullstack',
    dir: 'analog-direct',
    cmd: 'npm',
    args: ['run', 'build']
  }
];

/**
 * 本地 SDK 即時同步防禦機制 (Local SDK Hot-Sync)
 * 
 * 【背景痛點】：
 * 在 Monorepo 開發環境中，各範例安裝的是本地 tarball (.tgz)。
 * 當修改 `package/typescript/src/` 後重新編譯，若未更新版本號，
 * `npm install` 會因為 package-lock 判定版本相同而忽略更新，導致範例仍引用舊版代碼或資產。
 * 
 * 【解決方案】：
 * 此函式在建置前，主動檢查各範例的 `node_modules/ai-avatar-bot-typescript`，
 * 並將最新編譯出的 `dist/`、`avatar-skin/` 與 `package.json` 強制覆蓋同步進去。
 */
function autoSyncSdkLocal() {
  const srcRoot = path.join(packageRoot, 'typescript');
  const srcDist = path.join(srcRoot, 'dist');
  const srcSkin = path.join(srcRoot, 'avatar-skin');
  const srcPkg = path.join(srcRoot, 'package.json');

  // 若尚未編譯 SDK，則略過同步
  if (!fs.existsSync(srcDist)) return;

  for (const example of EXAMPLES) {
    const destDir = path.join(examplesRoot, example.dir, 'node_modules', 'ai-avatar-bot-typescript');
    if (fs.existsSync(destDir)) {
      try {
        // 同步最新的 JS/DTS 編譯產物
        fs.cpSync(srcDist, path.join(destDir, 'dist'), { recursive: true });
        // 同步最新的 2D/3D 模型與音訊資產
        fs.cpSync(srcSkin, path.join(destDir, 'avatar-skin'), { recursive: true });
        // 同步最新 package.json 定義
        fs.copyFileSync(srcPkg, path.join(destDir, 'package.json'));
      } catch (e) {
        // 忽略非致命同步警告（例如檔案被占用等）
      }
    }
  }
}

/**
 * 執行單一範例專案的生產打包
 * @param {object} example - 範例專案設定物件
 * @returns {{ success: boolean, durationSec: string }} 建置結果與耗時秒數
 */
function runBuild(example) {
  const exampleDir = path.join(examplesRoot, example.dir);
  const startTime = Date.now();

  console.log(`\n${colors.bold}${colors.cyan}▶ Building [${example.dir}]${colors.reset} - ${example.name}`);
  console.log(`${colors.dim}> [cwd: examples/${example.dir}] ${example.cmd} ${example.args.join(' ')}${colors.reset}`);

  // 跨平台相容性處理 (Windows 環境需開啟 shell)
  const isWindows = process.platform === 'win32';
  const result = spawnSync(example.cmd, example.args, {
    cwd: exampleDir,
    stdio: 'inherit',
    shell: isWindows || true
  });

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(2);

  // 檢查子行程退出碼 (Exit Code)
  if (result.status !== 0) {
    console.error(`\n${colors.red}${colors.bold}✗ Build FAILED for ${example.name} (${durationSec}s)${colors.reset}`);
    return { success: false, durationSec };
  }

  console.log(`${colors.green}${colors.bold}✓ Build PASSED for ${example.name} (${durationSec}s)${colors.reset}`);
  return { success: true, durationSec };
}

/**
 * 印出全量建置成果摘要統計表
 * @param {Array<object>} results - 所有範例的執行結果陣列
 */
function printSummary(results) {
  console.log(`\n${colors.bold}========================================================================${colors.reset}`);
  console.log(`${colors.bold}                  Examples Production Build Summary                    ${colors.reset}`);
  console.log(`${colors.bold}========================================================================${colors.reset}`);

  let allPassed = true;

  for (const item of results) {
    const statusText = item.success
      ? `${colors.green}PASS${colors.reset}`
      : `${colors.red}FAIL${colors.reset}`;
    const timeText = `${item.durationSec}s`.padStart(8);
    const namePadded = item.name.padEnd(38);
    console.log(`  ${namePadded} [${item.dir.padEnd(14)}] : ${statusText} (${timeText})`);
    if (item.success === false) {
      allPassed = false;
    }
  }

  console.log(`${colors.bold}========================================================================${colors.reset}`);

  // 全數通過回傳 code 0，有任一失敗回傳 code 1
  if (allPassed === true) {
    console.log(`${colors.bold}${colors.green}All ${results.length} example applications built successfully for production!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.bold}${colors.red}One or more example builds failed! Check logs above.${colors.reset}\n`);
    process.exit(1);
  }
}

/**
 * 主程式入口函式
 */
function main() {
  // 1. 執行本地 SDK 熱同步，確保範例吃到最新代碼
  autoSyncSdkLocal();

  // 2. 解析 CLI 目標參數 (預設為 'all')
  const targetArg = (process.argv[2] || 'all').toLowerCase();
  let targets = EXAMPLES;

  if (targetArg !== 'all') {
    // 依關鍵字過濾目標專案
    const matched = EXAMPLES.filter(
      (e) => e.key === targetArg || e.dir.includes(targetArg)
    );
    if (matched.length === 0) {
      console.error(`${colors.red}Unknown target: ${targetArg}${colors.reset}`);
      console.log(`Available targets: all, ${EXAMPLES.map((e) => e.key).join(', ')}`);
      process.exit(1);
    }
    targets = matched;
  }

  console.log(`${colors.bold}Starting Production Build for ${targets.length} Example(s)...${colors.reset}`);
  const results = [];

  // 3. 依序執行打包建置
  for (const example of targets) {
    const buildRes = runBuild(example);
    results.push({
      ...example,
      ...buildRes
    });

    if (buildRes.success === false) {
      // 遇到失敗立即中斷，避免無謂消耗資源
      break;
    }
  }

  // 4. 印出總結報告
  printSummary(results);
}

// 啟動執行
main();
