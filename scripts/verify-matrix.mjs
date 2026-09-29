#!/usr/bin/env node
/**
 * @file verify-matrix.mjs
 * Cross-platform, parameterized package manager verification runner.
 * Supports verifying multiple packages (typescript, react, vue, all) across npm & pnpm sandboxes.
 *
 * Usage:
 *   node scripts/verify-matrix.mjs [target]
 *   Targets: ts (default) | typescript | react | vue | all
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root paths
const packageRoot = path.resolve(__dirname, '..');
const sandboxBaseDir = path.join(packageRoot, '.temp-sandbox');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m'
};

function logStep(step, message) {
  console.log(`\n${colors.bold}${colors.cyan}[${step}]${colors.reset} ${message}`);
}

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
 * Registry of verifiable packages in this monorepo
 */
const TARGET_REGISTRY = {
  typescript: {
    name: 'TypeScript SDK (Core)',
    dirName: 'typescript',
    pkgName: 'ai-avatar-bot-typescript',
    buildArgs: ['yarn', ['build']],
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

// Aliases mapping
const ALIASES = {
  ts: 'typescript',
  core: 'typescript'
};

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

function prepareTarball(targetConfig) {
  const targetDir = path.join(packageRoot, targetConfig.dirName);
  logStep(`Build & Pack`, `Building and packing ${targetConfig.name} at package/${targetConfig.dirName}...`);

  // 1. Build
  const [cmd, args] = targetConfig.buildArgs;
  runCmd(cmd, args, targetDir);

  // 2. npm pack
  runCmd('npm', ['pack'], targetDir);

  // 3. Find generated .tgz
  const files = fs.readdirSync(targetDir);
  const tgzFile = files.find(f => f.startsWith(`${targetConfig.pkgName}-`) && f.endsWith('.tgz'));
  if (!tgzFile) {
    throw new Error(`Failed to find generated tarball for ${targetConfig.pkgName} in package/${targetConfig.dirName}`);
  }

  const tgzPath = path.join(targetDir, tgzFile);
  console.log(`${colors.green}✓ Tarball ready:${colors.reset} ${tgzPath}`);
  return tgzPath;
}

function prepareSandbox(targetDir, pmName, targetConfig) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  // package.json
  const pkgJson = {
    name: `sandbox-${targetConfig.dirName}-${pmName}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    ...(pmName === 'pnpm' ? { packageManager: 'pnpm@10.28.1' } : {})
  };
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // tsconfig.json
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

  // src/index.ts
  const testCode = targetConfig.generateTestCode(targetConfig.pkgName);
  fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), testCode);
}

function testPackageManager(pmName, targetConfig, tgzPath, installFn) {
  const sandboxDir = path.join(sandboxBaseDir, `matrix-${targetConfig.dirName}-${pmName}`);
  logStep(`Testing: ${pmName.toUpperCase()}`, `Creating isolated sandbox at ${path.relative(packageRoot, sandboxDir)}...`);

  prepareSandbox(sandboxDir, pmName, targetConfig);

  // 1. Install
  console.log(`${colors.cyan}> Running install with ${pmName}...${colors.reset}`);
  installFn(sandboxDir);

  // 2. TypeScript Type Check
  console.log(`${colors.cyan}> Running typecheck (tsc --noEmit)...${colors.reset}`);
  runCmd('npx', ['--yes', 'tsc', '--noEmit'], sandboxDir);

  // 3. Runtime execution test
  console.log(`${colors.cyan}> Running runtime module import check (tsx)...${colors.reset}`);
  runCmd('npx', ['--yes', 'tsx', 'src/index.ts'], sandboxDir);

  console.log(`${colors.green}✓ ${pmName.toUpperCase()} Matrix Verification PASSED!${colors.reset}`);
}

async function verifySingleTarget(targetKey) {
  const targetConfig = TARGET_REGISTRY[targetKey];
  console.log(`\n${colors.bold}${colors.yellow}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}  Target: ${targetConfig.name} (${targetConfig.pkgName})${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}======================================================${colors.reset}`);

  const targetResults = {};

  try {
    const tgzPath = prepareTarball(targetConfig);

    // Test NPM
    try {
      testPackageManager('npm', targetConfig, tgzPath, (dir) => {
        runCmd('npm', ['install', tgzPath, 'typescript', '--save-dev'], dir);
      });
      targetResults['npm (Flat Hoisting)'] = true;
    } catch (err) {
      console.error(`${colors.red}✗ NPM verification failed:${colors.reset}`, err.message);
      targetResults['npm (Flat Hoisting)'] = false;
    }

    // Test PNPM
    try {
      testPackageManager('pnpm', targetConfig, tgzPath, (dir) => {
        runCmd('corepack', ['pnpm', 'add', tgzPath, 'typescript', '-D'], dir);
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

  for (const key of targetKeys) {
    const res = await verifySingleTarget(key);
    fullReport[key] = res;
    if (Object.values(res).some(v => v === false)) {
      overallPassed = false;
    }
  }

  // Summary Table
  console.log(`\n${colors.bold}==================== Final Matrix Summary ====================${colors.reset}`);
  for (const [key, results] of Object.entries(fullReport)) {
    console.log(`\n[Package: ${TARGET_REGISTRY[key].pkgName}]`);
    for (const [envName, passed] of Object.entries(results)) {
      const mark = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
      console.log(`  ${envName.padEnd(30)} : ${mark}`);
    }
  }
  console.log(`\n${colors.bold}==============================================================${colors.reset}\n`);

  if (!overallPassed) {
    process.exit(1);
  }
}

main();
