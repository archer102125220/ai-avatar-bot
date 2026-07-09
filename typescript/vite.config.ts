import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import fs from 'fs';

function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          const apiPath = req.url.split('?')[0]; // e.g. '/api/tts'
          // map to 'example/api/tts.ts'
          const filePath = resolve(__dirname, 'example', apiPath.substring(1) + '.ts');
          
          if (fs.existsSync(filePath)) {
            try {
              // Use Vite's ssrLoadModule to transpile and load .ts files on the fly
              const apiModule = await server.ssrLoadModule(filePath);
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
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'AiAvatarBot',
      fileName: 'ai-avatar-bot'
    }
  },
  plugins: [dts(), apiPlugin()]
});
