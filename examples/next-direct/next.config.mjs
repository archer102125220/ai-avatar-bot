import path from 'path';
import { fileURLToPath } from 'url';
import withAiAvatarBot from 'ai-avatar-bot-typescript/next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname
};

export default withAiAvatarBot(nextConfig);
