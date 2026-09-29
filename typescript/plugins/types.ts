/**
 * @file TypeScript definitions for framework integration plugins and CLI options.
 * @module plugins/types
 */

export interface AvatarBotPluginOptions {
  /** Virtual URL route intercepted to serve avatar skin assets (default: '/avatar-skin'). */
  route?: string;
  /** Physical directory path where avatar-skin model files are stored. */
  assetsDir?: string;
  /** Public directory name for Next.js / framework builds (default: 'public'). */
  publicDir?: string;
  /** Whether to automatically sync assets during build (default: true). */
  autoSync?: boolean;
  /** Whether to suppress console log output (default: false). */
  silent?: boolean;
  /** Cache-Control max-age in seconds for static assets (default: 2592000). */
  maxAge?: number;
  /** Whether to overwrite existing destination files (default: true). */
  overwrite?: boolean;
}

export interface CopyDirOptions {
  /** Whether to overwrite existing destination files (default: true). */
  overwrite?: boolean;
}
