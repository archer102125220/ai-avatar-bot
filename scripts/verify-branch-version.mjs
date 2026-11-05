#!/usr/bin/env node
/**
 * @file verify-branch-version.mjs
 * @description 跨平台分支與版本號防呆攔截腳本 (Cross-Platform Branch & SemVer Guard)。
 *
 * 【防護規則】：
 * - 規則 A (preview 分支)：`typescript/package.json` 版本號必須包含 `-beta.`（例如 `1.0.0-beta.0`）。
 * - 規則 B (main 分支)：版本號嚴禁包含 `-beta` 等預覽後綴，且必須嚴格大於 (`>`) 目前倉庫最新的 SemVer Git Tag。
 *
 * 【支援環境】：
 * - 本地 Husky `pre-push` Hook（自動解析 Git stdin 推送目標分支，抹平 macOS / Windows 差異）
 * - GitHub Actions CI（自動讀取 `GITHUB_BASE_REF` 或 `GITHUB_REF_NAME`）
 * - 手動 CLI 測試（支援 `--branch <target>` 參數覆寫）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sdkPkgPath = path.join(repoRoot, 'typescript', 'package.json');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const ZERO_OID = '0000000000000000000000000000000000000000';
const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/**
 * 解析 SemVer 字串為結構化物件
 * @param {string} raw
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[] } | null}
 */
function parseSemver(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }
  const match = SEMVER_REGEX.exec(raw.trim());
  if (match === null) {
    return null;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (
    Number.isFinite(major) === false ||
    Number.isFinite(minor) === false ||
    Number.isFinite(patch) === false
  ) {
    return null;
  }

  const prereleaseRaw = typeof match[4] === 'string' ? match[4] : '';
  const prerelease = prereleaseRaw !== '' ? prereleaseRaw.split('.') : [];

  return { major, minor, patch, prerelease };
}

/**
 * 依據 SemVer 2.0.0 規範比較兩個版本號
 * 回傳 1 (a > b), -1 (a < b), 0 (a === b)
 * 注意：正式版嚴格大於同號預覽版（例如 `1.0.0 > 1.0.0-beta.0`）
 * @param {{ major: number, minor: number, patch: number, prerelease: string[] }} a
 * @param {{ major: number, minor: number, patch: number, prerelease: string[] }} b
 * @returns {number}
 */
function compareSemver(a, b) {
  if (a.major !== b.major) {
    return a.major > b.major ? 1 : -1;
  }
  if (a.minor !== b.minor) {
    return a.minor > b.minor ? 1 : -1;
  }
  if (a.patch !== b.patch) {
    return a.patch > b.patch ? 1 : -1;
  }

  const aHasPre = Array.isArray(a.prerelease) && a.prerelease.length > 0;
  const bHasPre = Array.isArray(b.prerelease) && b.prerelease.length > 0;

  if (aHasPre === false && bHasPre === false) {
    return 0;
  }
  if (aHasPre === false && bHasPre === true) {
    return 1;
  }
  if (aHasPre === true && bHasPre === false) {
    return -1;
  }

  const maxLen = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < maxLen; i += 1) {
    const idA = a.prerelease[i];
    const idB = b.prerelease[i];
    if (typeof idA === 'undefined') {
      return -1;
    }
    if (typeof idB === 'undefined') {
      return 1;
    }
    if (idA === idB) {
      continue;
    }

    const isNumA = /^\d+$/.test(idA);
    const isNumB = /^\d+$/.test(idB);

    if (isNumA === true && isNumB === true) {
      const numA = Number(idA);
      const numB = Number(idB);
      return numA > numB ? 1 : -1;
    }
    if (isNumA === true && isNumB === false) {
      return -1;
    }
    if (isNumA === false && isNumB === true) {
      return 1;
    }
    return idA > idB ? 1 : -1;
  }

  return 0;
}

/**
 * 取得倉庫內最新的 SemVer Git Tag（忽略如 archive/vanilla-js-baseline 等非版本標籤）
 * @returns {{ tag: string, parsed: { major: number, minor: number, patch: number, prerelease: string[] } } | null}
 */
function getLatestSemverGitTag() {
  const result = spawnSync('git', ['tag', '-l'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0 || typeof result.stdout !== 'string' || result.stdout.trim() === '') {
    return null;
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  let latest = null;
  for (const tag of lines) {
    const parsed = parseSemver(tag);
    if (parsed !== null) {
      if (latest === null || compareSemver(parsed, latest.parsed) > 0) {
        latest = { tag, parsed };
      }
    }
  }

  return latest;
}

/**
 * 解析此次驗證的目標分支清單
 * @returns {string[]}
 */
function resolveTargetBranches() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--branch' && typeof args[i + 1] === 'string' && args[i + 1] !== '') {
      return [args[i + 1].trim()];
    }
    if (arg.startsWith('--branch=')) {
      const val = arg.slice('--branch='.length).trim();
      if (val !== '') {
        return [val];
      }
    }
  }

  // GitHub Actions CI 環境：PR 優先檢查目標基底分支 (GITHUB_BASE_REF)，Push 檢查 GITHUB_REF_NAME
  if (process.env.GITHUB_ACTIONS === 'true') {
    const baseRef = typeof process.env.GITHUB_BASE_REF === 'string' ? process.env.GITHUB_BASE_REF.trim() : '';
    if (baseRef !== '') {
      return [baseRef];
    }
    const refName = typeof process.env.GITHUB_REF_NAME === 'string' ? process.env.GITHUB_REF_NAME.trim() : '';
    if (refName !== '') {
      return [refName];
    }
  }

  // Git pre-push Hook 環境：從 stdin 讀取 `<local_ref> <local_oid> <remote_ref> <remote_oid>`
  if (process.stdin.isTTY !== true) {
    try {
      const stdinText = fs.readFileSync(0, 'utf8');
      if (typeof stdinText === 'string' && stdinText.trim() !== '') {
        const branches = [];
        const lines = stdinText.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '') {
            continue;
          }
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 4) {
            const localOid = parts[1];
            const remoteRef = parts[2];
            // 若為刪除遠端分支，略過版本檢查
            if (localOid === ZERO_OID) {
              continue;
            }
            if (remoteRef.startsWith('refs/heads/')) {
              branches.push(remoteRef.slice('refs/heads/'.length));
            }
          }
        }
        if (branches.length > 0) {
          return branches;
        }
      }
    } catch {
      // Windows / 特殊終端無 stdin 時安全退回當前 HEAD 分支偵測
    }
  }

  // Fallback：讀取本地當前 Git 分支名稱
  const headRes = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (headRes.status === 0 && typeof headRes.stdout === 'string' && headRes.stdout.trim() !== '') {
    return [headRes.stdout.trim()];
  }

  return [];
}

/**
 * 針對單一目標分支執行版本合規性驗證
 * @param {string} branch
 * @param {string} pkgName
 * @param {string} version
 */
function verifyBranch(branch, pkgName, version) {
  if (branch === 'preview') {
    const parsed = parseSemver(version);
    const isValidBeta = version.includes('-beta.') === true && parsed !== null;
    if (isValidBeta === false) {
      console.error(`\n${colors.red}${colors.bold}✖ [Version Guard 攔截] 禁止推送至 "preview" 分支！${colors.reset}`);
      console.error(`${colors.red}  套件 ${pkgName} 當前版本為 "${version}"，不含合規的 "-beta." 預覽版後綴。${colors.reset}`);
      console.error(`${colors.yellow}  💡 修復建議：請於 package/typescript 目錄執行：${colors.reset}`);
      console.error(`     ${colors.cyan}npm version 1.0.0-beta.0 --no-git-tag-version${colors.reset}\n`);
      process.exit(1);
    }
    console.log(
      `${colors.green}✔ [Version Guard] 分支 "${branch}" 版本驗證通過 (${pkgName}@${version})${colors.reset}`
    );
    return;
  }

  if (branch === 'main') {
    const parsedCurrent = parseSemver(version);
    if (parsedCurrent === null) {
      console.error(`\n${colors.red}${colors.bold}✖ [Version Guard 攔截] 禁止推送至 "main" 分支！${colors.reset}`);
      console.error(`${colors.red}  套件 ${pkgName} 當前版本 "${version}" 非合法的 SemVer 格式。${colors.reset}\n`);
      process.exit(1);
    }

    const hasPrerelease =
      version.includes('-beta') === true ||
      (Array.isArray(parsedCurrent.prerelease) && parsedCurrent.prerelease.length > 0);

    if (hasPrerelease === true) {
      console.error(`\n${colors.red}${colors.bold}✖ [Version Guard 攔截] 禁止將預覽版推送至 "main" 正式分支！${colors.reset}`);
      console.error(`${colors.red}  套件 ${pkgName} 當前版本為 "${version}"，仍包含預覽後綴（如 -beta）。${colors.reset}`);
      console.error(`${colors.yellow}  💡 畢業轉正 SOP：請先拔除 -beta 後綴：${colors.reset}`);
      console.error(`     ${colors.cyan}cd typescript && npm version 1.0.0 --no-git-tag-version${colors.reset}\n`);
      process.exit(1);
    }

    const latestTagInfo = getLatestSemverGitTag();
    if (latestTagInfo !== null) {
      const cmp = compareSemver(parsedCurrent, latestTagInfo.parsed);
      if (cmp <= 0) {
        console.error(`\n${colors.red}${colors.bold}✖ [Version Guard 攔截] 禁止推送至 "main" 正式分支！${colors.reset}`);
        console.error(
          `${colors.red}  套件 ${pkgName} 當前版本 (${version}) 小於或等於最新 Git Tag (${latestTagInfo.tag})。${colors.reset}`
        );
        console.error(`${colors.yellow}  💡 修復建議：請遞增正式版號（patch / minor / major）後再推送。${colors.reset}\n`);
        process.exit(1);
      }
    }

    console.log(
      `${colors.green}✔ [Version Guard] 正式分支 "main" 版本驗證通過 (${pkgName}@${version}${
        latestTagInfo !== null ? ` > ${latestTagInfo.tag}` : ''
      })${colors.reset}`
    );
    return;
  }

  console.log(
    `${colors.cyan}ℹ [Version Guard] 目標分支 "${branch}" 非發布守門分支 (preview/main)，略過嚴格版號限制 (${pkgName}@${version})。${colors.reset}`
  );
}

function main() {
  if (fs.existsSync(sdkPkgPath) === false) {
    console.error(`${colors.red}✖ [Version Guard] 找不到套件設定檔: ${sdkPkgPath}${colors.reset}`);
    process.exit(1);
  }

  const rawPkg = fs.readFileSync(sdkPkgPath, 'utf8');
  const pkgData = JSON.parse(rawPkg);
  const pkgName =
    typeof pkgData === 'object' && pkgData !== null && typeof pkgData.name === 'string' && pkgData.name !== ''
      ? pkgData.name
      : '@ai-avatar-bot/sdk';
  const version =
    typeof pkgData === 'object' && pkgData !== null && typeof pkgData.version === 'string'
      ? pkgData.version.trim()
      : '';

  if (version === '') {
    console.error(`${colors.red}✖ [Version Guard] ${sdkPkgPath} 缺少有效的 version 欄位。${colors.reset}`);
    process.exit(1);
  }

  const targetBranches = resolveTargetBranches();
  if (targetBranches.length === 0) {
    console.log(`${colors.cyan}ℹ [Version Guard] 未偵測到目標推送分支，略過檢查。${colors.reset}`);
    process.exit(0);
  }

  for (const branch of targetBranches) {
    verifyBranch(branch, pkgName, version);
  }
}

main();

