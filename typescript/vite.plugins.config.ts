/**
 * @file Vite Node.js plugins & CLI build configuration.
 * Compiles TypeScript source files from plugins/ and bin/ into dist/plugins/ and dist/bin/.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['plugins/**/*.ts', 'bin/**/*.ts'],
      outDir: 'dist',
      entryRoot: '.'
    }),
    {
      name: 'make-cli-executable',
      closeBundle() {
        try {
          const cliPath = resolve(import.meta.dirname, 'dist/bin/cli.js');
          if (fs.existsSync(cliPath) && process.platform !== 'win32') {
            fs.chmodSync(cliPath, '755');
          }
        } catch {
          // ignore error on platforms or environments without permission support
        }
      }
    }
  ],
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    ssr: true,
    outDir: 'dist',
    lib: {
      entry: {
        'plugins/node': resolve(import.meta.dirname, 'plugins/node.ts'),
        'plugins/vite': resolve(import.meta.dirname, 'plugins/vite.ts'),
        'plugins/webpack': resolve(import.meta.dirname, 'plugins/webpack.ts'),
        'plugins/next': resolve(import.meta.dirname, 'plugins/next.ts'),
        'plugins/nuxt': resolve(import.meta.dirname, 'plugins/nuxt.ts'),
        'plugins/analog': resolve(import.meta.dirname, 'plugins/analog.ts'),
        'plugins/nitro': resolve(import.meta.dirname, 'plugins/nitro.ts'),
        'plugins/index': resolve(import.meta.dirname, 'plugins/index.ts'),
        'bin/cli': resolve(import.meta.dirname, 'bin/cli.ts')
      },
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'plugins/chunks/[name]-[hash].js',
          exports: 'named',
          banner: (chunk) => {
            if (chunk.name === 'bin/cli') {
              return '#!/usr/bin/env node\n';
            }
            return '';
          }
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'plugins/chunks/[name]-[hash].cjs',
          exports: 'named',
          banner: (chunk) => {
            if (chunk.name === 'bin/cli') {
              return '#!/usr/bin/env node\n';
            }
            return '';
          }
        }
      ]
    }
  }
});
