#!/usr/bin/env node
/**
 * @file verify-matrix.mjs
 * @description 跨套件管理器隔離矩陣驗證器 (Package Manager Matrix Verification Runner)。
 *
 * 【核心用途】：
 * 1. 模擬真實終端開發者（外部消費者）的情境，在完全乾淨、隔離的臨時目錄 (`.temp-sandbox/`) 中進行端到端安裝與構建。
 * 2. 測試雙核心套件管理器生態系：
 *    - NPM ：測試「扁平提升 (Flat Hoisting)」模式下的相依性解析。
 *    - PNPM：測試「嚴格符號連結 (Isolated Symlinks)」隔離模式，防禦幽靈依賴 (Phantom Dependencies) 導致的找不到模組問題。
 * 3. 執行 4 道自動化驗收防線：
 *    - 防線 1：套件安裝 (`npm install` / `pnpm add`)
 *    - 防線 2：靜態型別編譯檢測 (`tsc --noEmit`)，驗證 `.d.ts` 定義完整性
 *    - 防線 3：執行期模組子路徑動態載入檢測 (`tsx src/index.ts`)，驗證所有 subpath exports (`/brain`, `/skin`, `/speech`, `/tools`, `/i18n`, `/constants`, `/vite`)
 *    - 防線 4：Vite 構建器整合檢測 (`vite build`)，驗證打包工具外掛與資產複製功能
 *
 * 【使用方式 (CLI)】：
 *   node scripts/verify-matrix.mjs [target]
 *   yarn test:matrix [target]
 *
 * 【可選目標 target】：
 *   ts (預設，測試 core typescript SDK) | typescript | react | vue | all
 *
 * 【範例】：
 *   yarn test:matrix        # 驗證 TypeScript 核心套件
 *   yarn test:matrix all    # 驗證全套件清單
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// 取得當前檔案路徑與專案根目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 根目錄與臨時沙盒目錄路徑
const packageRoot = path.resolve(__dirname, '..');
const sandboxBaseDir = path.join(packageRoot, '.temp-sandbox');

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
 * 格式化輸出各步驟標題日誌
 * @param {string} step - 步驟識別碼 (如 "Build & Pack", "Testing: NPM")
 * @param {string} message - 步驟說明文字
 */
function logStep(step, message) {
  console.log(`\n${colors.bold}${colors.cyan}[${step}]${colors.reset} ${message}`);
}

/**
 * 跨平台執行同步 Shell 命令，失敗時拋出例外
 * @param {string} command - 執行的主命令 (如 npm, npx, yarn)
 * @param {string[]} args - 命令行參數陣列
 * @param {string} cwd - 執行的工作目錄
 */
function runCmd(command, args, cwd) {
  const isWindows = process.platform === 'win32';
  const cmdStr = `${command} ${args.join(' ')}`;
  console.log(`${colors.dim}> [cwd: ${path.relative(packageRoot, cwd)}] ${cmdStr}${colors.reset}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows || true
  });

  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${cmdStr}`);
  }
}

/**
 * 可驗證套件註冊表 (Target Registry)
 * 定義各套件的名稱、所在目錄、打包命令與動態生成的沙盒測試代碼
 */
const TARGET_REGISTRY = {
  typescript: {
    name: 'TypeScript SDK (Core)',
    dirName: 'typescript',
    pkgName: 'ai-avatar-bot-typescript',
    buildArgs: ['yarn', ['build']],
    // 為沙盒動態生成的測試腳本：涵蓋所有 subpath exports 與型別定義
    generateTestCode: (pkgName) => `import { 
  initAvatarBot, 
  type AvatarBotOptions, 
  type AvatarMode, 
  type Gender 
} from '${pkgName}';

import { initBrainEngine } from '${pkgName}/brain';
import { initSkinEngine } from '${pkgName}/skin';
import { initSpeechEngine } from '${pkgName}/speech';
import { initToolsEngine } from '${pkgName}/tools';
import { initI18nEngine, resolveLocalized } from '${pkgName}/i18n';
import { AVATAR_MODE_MAP, GENDER_MAP } from '${pkgName}/constants';
import { avatarBotVitePlugin } from '${pkgName}/vite';

const mode: AvatarMode = AVATAR_MODE_MAP.assistant;
const gender: Gender = GENDER_MAP.female;

const options: AvatarBotOptions = {
  container: null,
  avatarMode: mode,
  gender: gender,
  welcomeText: 'Verification Passed'
};

const checks = {
  initAvatarBot: typeof initAvatarBot,
  initBrainEngine: typeof initBrainEngine,
  initSkinEngine: typeof initSkinEngine,
  initSpeechEngine: typeof initSpeechEngine,
  initToolsEngine: typeof initToolsEngine,
  initI18nEngine: typeof initI18nEngine,
  resolveLocalized: typeof resolveLocalized,
  avatarBotVitePlugin: typeof avatarBotVitePlugin
};

const allFunctions = Object.values(checks).every(t => t === 'function');
if (!allFunctions) {
  throw new Error('Check failed: ' + JSON.stringify(checks));
}

console.log('✓ Options validated:', options.welcomeText);
console.log('✓ All subpath exports and functions successfully verified!');
`
  },
  react: {
    name: 'React Wrapper Package',
    dirName: 'react',
    pkgName: 'ai-avatar-bot-react',
    buildArgs: ['yarn', ['build']],
    generateTestCode: (pkgName) => `console.log('React package placeholder verification for ${pkgName}');`
  },
  vue: {
    name: 'Vue Wrapper Package',
    dirName: 'vue',
    pkgName: 'ai-avatar-bot-vue',
    buildArgs: ['yarn', ['build']],
    generateTestCode: (pkgName) => `console.log('Vue package placeholder verification for ${pkgName}');`
  }
};

// 簡短別名縮寫對應
const ALIASES = {
  ts: 'typescript',
  core: 'typescript'
};

/**
 * 解析使用者輸入的 CLI 目標參數
 * @param {string} rawTarget - 原始參數
 * @returns {string[]} 解析後的目標 key 陣列
 */
function resolveTargetKeys(rawTarget) {
  const clean = (rawTarget || 'typescript').toLowerCase().replace(/^--target=/, '');
  if (clean === 'all') {
    return Object.keys(TARGET_REGISTRY);
  }
  const resolved = ALIASES[clean] || clean;
  if (!TARGET_REGISTRY[resolved]) {
    console.error(`${colors.red}Error: Unknown target "${clean}".${colors.reset}`);
    console.log(`Available targets: ${Object.keys(TARGET_REGISTRY).join(', ')}, all (or alias: ts)`);
    process.exit(1);
  }
  return [resolved];
}

/**
 * 先行編譯套件並透過 npm pack 產出真正的 tarball (.tgz) 壓縮包
 * @param {object} targetConfig - 套件設定物件
 * @returns {string} 產出的 .tgz 檔案絕對路徑
 */
function prepareTarball(targetConfig) {
  const targetDir = path.join(packageRoot, targetConfig.dirName);
  logStep(`Build & Pack`, `Building and packing ${targetConfig.name} at package/${targetConfig.dirName}...`);

  // 1. 執行套件建置 (產出 dist/)
  const [cmd, args] = targetConfig.buildArgs;
  runCmd(cmd, args, targetDir);

  // 2. 執行 npm pack 打包成 .tgz
  runCmd('npm', ['pack'], targetDir);

  // 3. 搜尋並取得產生的 .tgz 檔案路徑
  const files = fs.readdirSync(targetDir);
  const tgzFile = files.find(f => f.startsWith(`${targetConfig.pkgName}-`) && f.endsWith('.tgz'));
  if (!tgzFile) {
    throw new Error(`Failed to find generated tarball for ${targetConfig.pkgName} in package/${targetConfig.dirName}`);
  }

  const tgzPath = path.join(targetDir, tgzFile);
  console.log(`${colors.green}✓ Tarball ready:${colors.reset} ${tgzPath}`);
  return tgzPath;
}

/**
 * 初始化沙盒專案環境 (建立 package.json, tsconfig.json, index.html, vite.config.ts, src/index.ts)
 * @param {string} targetDir - 沙盒目錄路徑
 * @param {string} pmName - 套件管理員名稱 (npm 或 pnpm)
 * @param {object} targetConfig - 套件設定物件
 */
function prepareSandbox(targetDir, pmName, targetConfig) {
  // 清理既有沙盒目錄
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  // 1. 生成 package.json
  const pkgJson = {
    name: `sandbox-${targetConfig.dirName}-${pmName}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    ...(pmName === 'pnpm' ? { packageManager: 'pnpm@10.28.1' } : {})
  };
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // 2. 生成 tsconfig.json (嚴格型別檢查配置)
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true
    },
    include: ['src/**/*']
  };
  fs.writeFileSync(path.join(targetDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  // 3. 生成 index.html (供 Vite 生產打包檢測)
  const indexHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Matrix Sandbox</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/index.ts"></script>
  </body>
</html>`;
  fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtml);

  // 4. 生成 vite.config.ts (若測試 TypeScript 核心套件，掛載 avatarBotVitePlugin 驗證)
  if (targetConfig.dirName === 'typescript') {
    const viteConfig = `import { defineConfig } from 'vite';
import avatarBotVitePlugin from 'ai-avatar-bot-typescript/vite';

export default defineConfig({
  plugins: [avatarBotVitePlugin()]
});`;
    fs.writeFileSync(path.join(targetDir, 'vite.config.ts'), viteConfig);
  }

  // 5. 生成測試程式碼 src/index.ts
  const testCode = targetConfig.generateTestCode(targetConfig.pkgName);
  fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), testCode);
}

/**
 * 針對特定套件管理器 (npm 或 pnpm) 執行 4 大防線測試
 * @param {string} pmName - 'npm' | 'pnpm'
 * @param {object} targetConfig - 目標套件配置
 * @param {string} tgzPath - .tgz 壓縮包路徑
 * @param {Function} installFn - 安裝回呼函式
 */
function testPackageManager(pmName, targetConfig, tgzPath, installFn) {
  const sandboxDir = path.join(sandboxBaseDir, `matrix-${targetConfig.dirName}-${pmName}`);
  logStep(`Testing: ${pmName.toUpperCase()}`, `Creating isolated sandbox at ${path.relative(packageRoot, sandboxDir)}...`);

  // 初始化乾淨沙盒
  prepareSandbox(sandboxDir, pmName, targetConfig);

  // 防線 1: 執行套件安裝
  console.log(`${colors.cyan}> Running install with ${pmName}...${colors.reset}`);
  installFn(sandboxDir);

  // 防線 2: 靜態型別編譯檢測 (tsc --noEmit)
  console.log(`${colors.cyan}> Running typecheck (tsc --noEmit)...${colors.reset}`);
  runCmd('npx', ['--yes', 'tsc', '--noEmit'], sandboxDir);

  // 防線 3: 運行時期動態匯入檢測 (tsx)
  console.log(`${colors.cyan}> Running runtime module import check (tsx)...${colors.reset}`);
  runCmd('npx', ['--yes', 'tsx', 'src/index.ts'], sandboxDir);

  // 防線 4: Vite 生產環境打包測試 (vite build)
  console.log(`${colors.cyan}> Running Vite production build (vite build)...${colors.reset}`);
  runCmd('npx', ['--yes', 'vite', 'build'], sandboxDir);

  // 檢查產物 dist/ 是否確實產生
  const distDir = path.join(sandboxDir, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(`Build finished but dist/ directory not found in ${sandboxDir}`);
  }
  console.log(`${colors.green}✓ Production build verified (dist/ generated)${colors.reset}`);

  console.log(`${colors.green}✓ ${pmName.toUpperCase()} Matrix Verification PASSED!${colors.reset}`);
}

/**
 * 對單一套件執行完整的 npm 與 pnpm 矩陣檢驗
 * @param {string} targetKey - 套件鍵值 (如 'typescript')
 * @returns {Promise<Record<string, boolean>>} 矩陣檢測結果對應表
 */
async function verifySingleTarget(targetKey) {
  const targetConfig = TARGET_REGISTRY[targetKey];
  console.log(`\n${colors.bold}${colors.yellow}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}  Target: ${targetConfig.name} (${targetConfig.pkgName})${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}======================================================${colors.reset}`);

  const targetResults = {};

  try {
    // 預先打包產生 .tgz
    const tgzPath = prepareTarball(targetConfig);

    // 1. 測試 NPM (Flat Hoisting 模式)
    try {
      testPackageManager('npm', targetConfig, tgzPath, (dir) => {
        runCmd('npm', ['install', tgzPath, 'typescript', 'vite', '--save-dev'], dir);
      });
      targetResults['npm (Flat Hoisting)'] = true;
    } catch (err) {
      console.error(`${colors.red}✗ NPM verification failed:${colors.reset}`, err.message);
      targetResults['npm (Flat Hoisting)'] = false;
    }

    // 2. 測試 PNPM (Isolated Symlinks 嚴格隔離模式)
    try {
      testPackageManager('pnpm', targetConfig, tgzPath, (dir) => {
        runCmd('corepack', ['pnpm', 'add', tgzPath, 'typescript', 'vite', '-D'], dir);
      });
      targetResults['pnpm (Isolated Symlinks)'] = true;
    } catch (err) {
      console.error(`${colors.red}✗ PNPM verification failed:${colors.reset}`, err.message);
      targetResults['pnpm (Isolated Symlinks)'] = false;
    }

    return targetResults;
  } catch (err) {
    console.error(`${colors.red}Fatal error during target verification:${colors.reset}`, err.message);
    return {
      'npm (Flat Hoisting)': false,
      'pnpm (Isolated Symlinks)': false
    };
  }
}

/**
 * 主程式入口函式
 */
async function main() {
  const rawArg = process.argv[2];
  const targetKeys = resolveTargetKeys(rawArg);

  console.log(`${colors.bold}===================================================${colors.reset}`);
  console.log(`${colors.bold}  AI Avatar Bot: Parameterized Matrix Test Runner  ${colors.reset}`);
  console.log(`${colors.bold}===================================================${colors.reset}`);
  console.log(`OS Platform : ${process.platform} (${process.arch})`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Targets     : ${targetKeys.join(', ')}`);

  const fullReport = {};
  let overallPassed = true;

  // 逐一檢驗各指定套件
  for (const key of targetKeys) {
    const res = await verifySingleTarget(key);
    fullReport[key] = res;
    if (Object.values(res).some(v => v === false)) {
      overallPassed = false;
    }
  }

  // 印出最終驗收矩陣摘要統計表
  console.log(`\n${colors.bold}==================== Final Matrix Summary ====================${colors.reset}`);
  for (const [key, results] of Object.entries(fullReport)) {
    console.log(`\n[Package: ${TARGET_REGISTRY[key].pkgName}]`);
    for (const [envName, passed] of Object.entries(results)) {
      const mark = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
      console.log(`  ${envName.padEnd(30)} : ${mark}`);
    }
  }
  console.log(`\n${colors.bold}==============================================================${colors.reset}\n`);

  // 若有任何一項環境未通過，以 code 1 退出
  if (!overallPassed) {
    process.exit(1);
  }
}

// 啟動執行
main();
