#!/usr/bin/env node
/**
 * @file run-example.mjs
 * @description 範例專案伺服器啟動器 (Examples Server Runner)。
 *
 * 【核心用途】：
 * 1. 跨平台快速啟動任何範例專案的開發伺服器 (`dev` 模式，支援 HMR 熱重載)。
 * 2. 跨平台啟動任何範例專案的生產產物預覽伺服器 (`preview` 模式，驗證生產構建成果)。
 * 3. 內建智慧防呆防線：若以 `preview` 模式啟動時尚未進行生產打包（找不到 dist 或 .output），
 *    將自動觸發 `npm run build`，確保伺服器能夠順利預覽真實打包檔案。
 *
 * 【使用方式 (CLI)】：
 *   node scripts/run-example.mjs <mode> <target>
 *   yarn example:dev <target>
 *   yarn example:preview <target>
 *
 * 【模式 mode】：
 *   dev     : 啟動熱重載開發伺服器
 *   preview : 預覽生產打包產物 (靜態伺服器或 SSR 伺服器)
 *
 * 【目標 target 與別名 alias】：
 *   - vanilla-ts (alias: ts)
 *   - vanilla-js (alias: js)
 *   - react-direct (alias: react)
 *   - vue-direct (alias: vue)
 *   - next-direct (alias: next, nextjs)
 *   - nuxt-direct (alias: nuxt, nuxtjs)
 *   - angular-direct (alias: angular, ng)
 *   - analog-direct (alias: analog, analogjs)
 *
 * 【範例】：
 *   yarn example:dev react       # 啟動 React 19 開發伺服器
 *   yarn example:preview next    # 預覽 Next.js 15 生產伺服器
 *   yarn example:preview angular # 預覽 Angular 19 生產伺服器
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';

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
 * 8 大範例專案伺服器配置設定
 * @property {string} key - 標準識別碼
 * @property {string[]} alias - 方便 CLI 輸入的別名縮寫清單
 * @property {string} name - 友善展示名稱
 * @property {string} dir - 範例目錄名稱
 * @property {number} defaultPort - 框架預設監聽的連接埠
 */
const EXAMPLES = [
  {
    key: 'vanilla-ts',
    alias: ['ts', 'vanilla-ts'],
    name: 'Vanilla TypeScript SPA',
    dir: 'vanilla-ts',
    defaultPort: 3000
  },
  {
    key: 'vanilla-js',
    alias: ['js', 'vanilla-js'],
    name: 'Vanilla Pure JavaScript SPA',
    dir: 'vanilla-js',
    defaultPort: 3001
  },
  {
    key: 'react-direct',
    alias: ['react', 'react-direct'],
    name: 'React 19 Client SPA',
    dir: 'react-direct',
    defaultPort: 3002
  },
  {
    key: 'vue-direct',
    alias: ['vue', 'vue-direct'],
    name: 'Vue 3 SFC Client SPA',
    dir: 'vue-direct',
    defaultPort: 3003
  },
  {
    key: 'next-direct',
    alias: ['next', 'nextjs', 'next-direct'],
    name: 'Next.js 15 App Router Fullstack',
    dir: 'next-direct',
    defaultPort: 3000
  },
  {
    key: 'nuxt-direct',
    alias: ['nuxt', 'nuxtjs', 'nuxt-direct'],
    name: 'Nuxt 3 Nitro Fullstack',
    dir: 'nuxt-direct',
    defaultPort: 3000
  },
  {
    key: 'angular-direct',
    alias: ['angular', 'ng', 'angular-direct'],
    name: 'Angular 19 Standalone SPA',
    dir: 'angular-direct',
    defaultPort: 4200
  },
  {
    key: 'analog-direct',
    alias: ['analog', 'analogjs', 'analog-direct'],
    name: 'Analog.js on Vite+Nitro Fullstack',
    dir: 'analog-direct',
    defaultPort: 5173
  }
];

/**
 * 印出 CLI 使用指引與可用目標列表
 */
function printHelp() {
  console.log(`\n${colors.bold}${colors.cyan}AI Avatar Bot - Examples Runner${colors.reset}`);
  console.log(`${colors.dim}Easily run any example in development or production preview mode.${colors.reset}\n`);
  console.log(`${colors.bold}Usage:${colors.reset}`);
  console.log(`  node scripts/run-example.mjs <mode> <target>`);
  console.log(`  yarn example:dev <target>`);
  console.log(`  yarn example:preview <target>\n`);
  console.log(`${colors.bold}Modes:${colors.reset}`);
  console.log(`  ${colors.green}dev${colors.reset}     : Starts development hot-reloading server`);
  console.log(`  ${colors.yellow}preview${colors.reset} : Serves the production build output\n`);
  console.log(`${colors.bold}Available Targets:${colors.reset}`);
  for (const ex of EXAMPLES) {
    console.log(`  - ${colors.bold}${ex.key.padEnd(16)}${colors.reset} (alias: ${ex.alias.join(', ')}) -> ${ex.name}`);
  }
  console.log('');
}

/**
 * 將使用者輸入的 target 名稱或別名解析為標準設定物件
 * @param {string} targetName - 使用者傳入的關鍵字
 * @returns {object|null} 匹配到的範例設定物件，未找到則回傳 null
 */
function resolveTarget(targetName) {
  if (!targetName) return null;
  const lower = targetName.toLowerCase();
  return EXAMPLES.find(
    (e) => e.key === lower || e.dir === lower || e.alias.includes(lower)
  ) || null;
}

/**
 * 主程式入口函式
 */
function main() {
  const modeArg = (process.argv[2] || '').toLowerCase();
  const targetArg = (process.argv[3] || '').toLowerCase();

  // 1. 驗證模式參數是否合法 (dev 或 preview)
  if (!modeArg || !['dev', 'preview'].includes(modeArg)) {
    printHelp();
    process.exit(1);
  }

  // 2. 解析目標專案
  const example = resolveTarget(targetArg);
  if (!example) {
    console.error(`\n${colors.red}${colors.bold}Error: Target "${targetArg}" not found!${colors.reset}`);
    printHelp();
    process.exit(1);
  }

  const exampleDir = path.join(examplesRoot, example.dir);

  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Starting ${modeArg.toUpperCase()} mode for: ${example.name}${colors.reset}`);
  console.log(`${colors.dim}  Directory: examples/${example.dir}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  // 3. 預覽防呆檢查 (Preview Guard)：
  // 若為 preview 模式，檢查各框架的打包產物目錄是否存在；若不存在則自動先執行 npm run build
  if (modeArg === 'preview') {
    const isNext = example.key === 'next-direct';
    const isNuxt = example.key === 'nuxt-direct';
    const buildCheckPath = isNext
      ? path.join(exampleDir, '.next')
      : isNuxt
        ? path.join(exampleDir, '.output')
        : path.join(exampleDir, 'dist');

    if (!fs.existsSync(buildCheckPath)) {
      console.log(`${colors.yellow}Production build artifact not found. Running build first...${colors.reset}`);
      const isWindows = process.platform === 'win32';
      const buildRes = spawnSync('npm', ['run', 'build'], {
        cwd: exampleDir,
        stdio: 'inherit',
        shell: isWindows || true
      });
      if (buildRes.status !== 0) {
        console.error(`${colors.red}Build failed! Cannot start preview.${colors.reset}`);
        process.exit(1);
      }
    }
  }

  // 4. 以串流互動模式啟動目標專案之 dev 或 preview 伺服器
  const isWindows = process.platform === 'win32';
  const child = spawn('npm', ['run', modeArg], {
    cwd: exampleDir,
    stdio: 'inherit',
    shell: isWindows || true
  });

  // 接管子行程退出訊號 (如 Ctrl+C)
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

// 啟動執行
main();
