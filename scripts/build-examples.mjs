#!/usr/bin/env node
/**
 * @file build-examples.mjs
 * Unified cross-platform builder for all 8 example applications.
 * Ensures zero regression and robust production build guarding.
 *
 * Usage:
 *   node scripts/build-examples.mjs [target]
 *   Targets: all (default) | vanilla-ts | vanilla-js | react | vue | next | nuxt | angular | analog
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const examplesRoot = path.join(packageRoot, 'examples');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m'
};

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

import fs from 'node:fs';

function autoSyncSdkLocal() {
  const srcRoot = path.join(packageRoot, 'typescript');
  const srcDist = path.join(srcRoot, 'dist');
  const srcSkin = path.join(srcRoot, 'avatar-skin');
  const srcPkg = path.join(srcRoot, 'package.json');

  if (!fs.existsSync(srcDist)) return;

  for (const example of EXAMPLES) {
    const destDir = path.join(examplesRoot, example.dir, 'node_modules', 'ai-avatar-bot-typescript');
    if (fs.existsSync(destDir)) {
      try {
        fs.cpSync(srcDist, path.join(destDir, 'dist'), { recursive: true });
        fs.cpSync(srcSkin, path.join(destDir, 'avatar-skin'), { recursive: true });
        fs.copyFileSync(srcPkg, path.join(destDir, 'package.json'));
      } catch (e) {
        // ignore sync warning
      }
    }
  }
}

function runBuild(example) {
  const exampleDir = path.join(examplesRoot, example.dir);
  const startTime = Date.now();

  console.log(`\n${colors.bold}${colors.cyan}▶ Building [${example.dir}]${colors.reset} - ${example.name}`);
  console.log(`${colors.dim}> [cwd: examples/${example.dir}] ${example.cmd} ${example.args.join(' ')}${colors.reset}`);

  const isWindows = process.platform === 'win32';
  const result = spawnSync(example.cmd, example.args, {
    cwd: exampleDir,
    stdio: 'inherit',
    shell: isWindows || true
  });

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(2);

  if (result.status !== 0) {
    console.error(`\n${colors.red}${colors.bold}✗ Build FAILED for ${example.name} (${durationSec}s)${colors.reset}`);
    return { success: false, durationSec };
  }

  console.log(`${colors.green}${colors.bold}✓ Build PASSED for ${example.name} (${durationSec}s)${colors.reset}`);
  return { success: true, durationSec };
}

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

  if (allPassed === true) {
    console.log(`${colors.bold}${colors.green}All ${results.length} example applications built successfully for production!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.bold}${colors.red}One or more example builds failed! Check logs above.${colors.reset}\n`);
    process.exit(1);
  }
}

function main() {
  autoSyncSdkLocal();

  const targetArg = (process.argv[2] || 'all').toLowerCase();
  let targets = EXAMPLES;

  if (targetArg !== 'all') {
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

  for (const example of targets) {
    const buildRes = runBuild(example);
    results.push({
      ...example,
      ...buildRes
    });

    if (buildRes.success === false) {
      // Early exit on failure to prevent cascading
      break;
    }
  }

  printSummary(results);
}

main();
