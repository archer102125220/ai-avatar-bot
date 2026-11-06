/**
 * @file Vercel Serverless Function 入口 (`/api/tts`)
 *
 * 【設計說明】：
 * 1. 本地開發 (`yarn dev`) 時由 `vite.config.ts` 掛載的 `shared/vite-api-plugin.ts` 攔截 `/api/tts`。
 * 2. 線上部署至 Vercel (`ai-avatar-bot-sdk-demo`) 時，Vercel 會自動將本檔案編譯為 Node.js Serverless Function，
 *    直接複用 `package/shared/api/tts.ts` 的微軟 Edge 神經語音合成、同網域來源檢查與簡易限流邏輯。
 * 3. 因 `typescript/package.json` 已透過 `"files": ["dist", "avatar-skin"]` 限定發布白名單，
 *    本目錄僅供線上 Demo 部署使用，不會被打包進 `@ai-avatar-bot/sdk` NPM 套件中。
 */

export { default } from '../../shared/api/tts.js';
