import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function apiPlugin() {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.startsWith('/api/')) {
          const apiPath = req.url.split('?')[0]; // e.g. '/api/tts'
          // map to 'example/api/tts.js'
          const filePath = resolve(__dirname, 'example', apiPath.substring(1) + '.js');
          
          if (fs.existsSync(filePath)) {
            try {
              // use a timestamp to prevent caching during dev
              const moduleUrl = new URL(`file://${filePath}`);
              const apiModule = await import(`${moduleUrl.href}?t=${Date.now()}`);
              const handler = apiModule.default || apiModule;
              
              if (typeof handler === 'function') {
                return handler(req, res);
              }
            } catch (err) {
              console.error(`Error executing API ${apiPath}:`, err);
              res.statusCode = 500;
              return res.end('Internal Server Error');
            }
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'core/index.js'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  }
});
