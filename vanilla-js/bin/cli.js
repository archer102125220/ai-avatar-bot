#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getAvatarSkinPath, copyDirRecursive } from '../plugins/node.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const pkgJsonPath = path.resolve(currentDir, '../package.json');
let pkgVersion = '1.0.0';

try {
  if (fs.existsSync(pkgJsonPath) === true) {
    const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (typeof pkgData?.version === 'string' && pkgData.version !== '') {
      pkgVersion = pkgData.version;
    }
  }
} catch {
  // 忽略讀取 package.json 的錯誤，保留預設版本
}

/**
 * 格式化輸出幫助訊息
 */
function printHelp() {
  console.log(`
\x1B[1m\x1B[36mAI Avatar Bot CLI\x1B[0m (v${pkgVersion})
離線人像模型與靜態資產管理工具

\x1B[1m使用方式 (Usage):\x1B[0m
  $ npx ai-avatar-bot [command] [options]
  $ npx ai-avatar-bot sync [options]

\x1B[1m指令 (Commands):\x1B[0m
  sync               同步 avatar-skin 靜態模型至專案目錄（預設指令）
  help, -h, --help   顯示說明手冊
  -v, --version      顯示當前版本

\x1B[1m參數 (Options):\x1B[0m
  -o, --out <path>   指定目標輸出目錄（預設自動偵測框架）
  -f, --force        強制覆蓋目標目錄中已存在的檔案（預設開啟）
  --no-overwrite     若目標檔案已存在則略過不覆蓋
  --dry-run          僅模擬執行並顯示目標路徑，不實際寫入硬碟

\x1B[1m自動偵測規則 (Auto-detection):\x1B[0m
  • Angular 專案 (angular.json)       ➔ src/assets/avatar-skin
  • Next.js 專案 (next.config.*)      ➔ public/avatar-skin
  • Nuxt 專案 (nuxt.config.*)         ➔ public/avatar-skin
  • 一般網頁專案 (含 public 目錄)      ➔ public/avatar-skin
  • 其他專案預設                     ➔ public/avatar-skin
`);
}

/**
 * 自動偵測當前專案類型並決定最佳目標目錄
 * @param {string} cwd - 當前工作目錄
 * @returns {{ targetDir: string, projectType: string, tip: string }}
 */
function detectProjectTarget(cwd) {
  // 1. Angular 專案偵測
  const angularJsonPath = path.join(cwd, 'angular.json');
  if (fs.existsSync(angularJsonPath) === true) {
    return {
      targetDir: 'src/assets/avatar-skin',
      projectType: 'Angular CLI',
      tip: '請確認 angular.json 中已包含 "src/assets" 設定。'
    };
  }

  // 2. Next.js 專案偵測
  const nextConfigs = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs'];
  for (const config of nextConfigs) {
    if (fs.existsSync(path.join(cwd, config)) === true) {
      return {
        targetDir: 'public/avatar-skin',
        projectType: 'Next.js',
        tip: '亦可使用 "ai-avatar-bot-vanilla-js/next" 插件在打包時自動同步。'
      };
    }
  }

  // 3. Nuxt 專案偵測
  const nuxtConfigs = ['nuxt.config.js', 'nuxt.config.ts', 'nuxt.config.mjs'];
  for (const config of nuxtConfigs) {
    if (fs.existsSync(path.join(cwd, config)) === true) {
      return {
        targetDir: 'public/avatar-skin',
        projectType: 'Nuxt',
        tip: '亦可於 nuxt.config.ts 的 modules 加入 "ai-avatar-bot-vanilla-js/nuxt" 達成 0 複製開發。'
      };
    }
  }

  // 4. 檢查一般 public 目錄
  const publicDirPath = path.join(cwd, 'public');
  if (fs.existsSync(publicDirPath) === true && fs.statSync(publicDirPath).isDirectory() === true) {
    return {
      targetDir: 'public/avatar-skin',
      projectType: 'Web Project (public/)',
      tip: ''
    };
  }

  return {
    targetDir: 'public/avatar-skin',
    projectType: 'Standard Web',
    tip: ''
  };
}

/**
 * 取得目錄內部所有檔案列表
 * @param {string} dirPath - 目錄路徑
 * @param {string} [basePath=''] - 相對基準路徑
 * @returns {string[]} 檔案相對路徑陣列
 */
function getFilesRecursive(dirPath, basePath = '') {
  const result = [];
  if (fs.existsSync(dirPath) === false) {
    return result;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue;
    }
    const rel = path.join(basePath, entry.name);
    const full = path.join(dirPath, entry.name);

    if (entry.isDirectory() === true) {
      result.push(...getFilesRecursive(full, rel));
    } else {
      result.push(rel);
    }
  }
  return result;
}

/**
 * 主執行入口
 */
async function main() {
  const args = process.argv.slice(2);

  // 參數解析
  let command = 'sync';
  let customOut = '';
  let overwrite = true;
  let isDryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help' || arg === 'help') {
      printHelp();
      process.exit(0);
    } else if (arg === '-v' || arg === '--version' || arg === 'version') {
      console.log(`v${pkgVersion}`);
      process.exit(0);
    } else if (arg === '-o' || arg === '--out') {
      if (typeof args[i + 1] === 'string' && args[i + 1] !== '' && args[i + 1].startsWith('-') === false) {
        customOut = args[i + 1];
        i += 1;
      }
    } else if (arg.startsWith('--out=')) {
      customOut = arg.slice(6);
    } else if (arg === '-f' || arg === '--force') {
      overwrite = true;
    } else if (arg === '--no-overwrite') {
      overwrite = false;
    } else if (arg === '--dry-run') {
      isDryRun = true;
    } else if (arg.startsWith('-') === false && i === 0) {
      command = arg;
    }
  }

  if (command !== 'sync') {
    console.warn(`\x1B[33m[ai-avatar-bot]\x1B[0m 未知指令: "${command}"，預設執行 sync。\n`);
  }

  const cwd = process.cwd();
  const srcDir = getAvatarSkinPath();

  if (fs.existsSync(srcDir) === false) {
    console.error(`\x1B[31m[ai-avatar-bot 錯誤]\x1B[0m 找不到套件內部 avatar-skin 資產目錄: ${srcDir}`);
    process.exit(1);
  }

  let finalTargetRel = customOut;
  let detectedInfo = null;

  if (typeof finalTargetRel !== 'string' || finalTargetRel.trim() === '') {
    detectedInfo = detectProjectTarget(cwd);
    finalTargetRel = detectedInfo.targetDir;
  }

  const resolvedTarget = path.resolve(cwd, finalTargetRel);
  const fileList = getFilesRecursive(srcDir);

  console.log(`\n\x1B[1m\x1B[36m[ai-avatar-bot]\x1B[0m 資產同步程序啟動 (v${pkgVersion})`);
  console.log(`來源目錄 (Source): \x1B[90m${srcDir}\x1B[0m`);
  console.log(`目標目錄 (Target): \x1B[32m${resolvedTarget}\x1B[0m`);

  if (detectedInfo !== null && detectedInfo.projectType !== '') {
    console.log(`偵測專案類型 (Type): \x1B[35m${detectedInfo.projectType}\x1B[0m`);
    if (detectedInfo.tip !== '') {
      console.log(`\x1B[33m💡 提示:\x1B[0m ${detectedInfo.tip}`);
    }
  }

  if (isDryRun === true) {
    console.log(`\n\x1B[33m[Dry Run 模擬模式 - 不會進行實際硬碟寫入]\x1B[0m`);
    console.log(`預計同步的檔案清單 (${fileList.length} 個項目):`);
    for (const f of fileList) {
      console.log(`  + ${path.join(finalTargetRel, f)}`);
    }
    console.log(`\n\x1B[32m✔ Dry Run 完成。\x1B[0m\n`);
    process.exit(0);
  }

  try {
    copyDirRecursive(srcDir, resolvedTarget, { overwrite });
    console.log(`\n\x1B[32m✔ 成功同步 ${fileList.length} 個資產檔案至 ${resolvedTarget}\x1B[0m\n`);
  } catch (err) {
    console.error(`\n\x1B[31m✖ 同步資產失敗:\x1B[0m`, err);
    process.exit(1);
  }
}

main();
