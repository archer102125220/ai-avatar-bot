#!/usr/bin/env node
/**
 * @file run-example.mjs
 * Cross-platform runner to easily launch any example application in DEV or PREVIEW mode.
 *
 * Usage:
 *   node scripts/run-example.mjs [dev|preview] [target]
 *
 * Examples:
 *   yarn example:dev react
 *   yarn example:preview next
 *   yarn example:dev vue
 *   yarn example:preview angular
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';

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

function resolveTarget(targetName) {
  if (!targetName) return null;
  const lower = targetName.toLowerCase();
  return EXAMPLES.find(
    (e) => e.key === lower || e.dir === lower || e.alias.includes(lower)
  ) || null;
}

function main() {
  const modeArg = (process.argv[2] || '').toLowerCase();
  const targetArg = (process.argv[3] || '').toLowerCase();

  if (!modeArg || !['dev', 'preview'].includes(modeArg)) {
    printHelp();
    process.exit(1);
  }

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

  // If preview mode, check if dist/build output exists; if not, prompt build
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

  const isWindows = process.platform === 'win32';
  const child = spawn('npm', ['run', modeArg], {
    cwd: exampleDir,
    stdio: 'inherit',
    shell: isWindows || true
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main();
