import { type Plugin } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          const apiPath = req.url.split('?')[0]; // e.g. '/api/tts'
          // map to 'package/shared/api/tts.ts'
          const filePath = resolve(
            __dirname,
            'api',
            apiPath.substring(5) + '.ts'
          ); // changed to substring(5) to get 'tts'

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
