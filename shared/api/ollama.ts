import type { IncomingMessage, ServerResponse } from 'http';
import * as http from 'http';

/* =====================================================================
 * api/ollama.ts
 * 本地 Ollama 代理伺服器，解決跨網域與共用問題。
 * 預設將請求轉發至 http://localhost:11434
 *
 * 支援透過 query string (?path=/api/generate)
 * 或是 Header (x-ollama-path: /api/generate) 指定要呼叫的 Ollama API 路徑。
 * 若無指定，預設為 /api/chat
 * ===================================================================== */

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;

export default async (req: IncomingMessage, res: ServerResponse) => {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-ollama-path'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '', 'http://localhost');

    // 取得目標路徑，優先順序：query > header > 預設值
    let targetPath = url.searchParams.get('path') || '';
    if (!targetPath) {
      const headerPath = req.headers['x-ollama-path'];
      targetPath = Array.isArray(headerPath) ? headerPath[0] : headerPath || '';
    }
    if (!targetPath) {
      targetPath = '/api/chat';
    }

    const proxyHeaders: Record<string, any> = {
      ...req.headers,
      host: `${OLLAMA_HOST}:${OLLAMA_PORT}`
    };

    // 移除可能導致問題的 headers
    delete proxyHeaders['connection'];
    delete proxyHeaders['x-ollama-path'];
    delete proxyHeaders['referer'];

    const proxyOptions: http.RequestOptions = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: targetPath,
      method: req.method,
      headers: proxyHeaders
    };

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('[Ollama Proxy Error]', e);
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({ error: 'Ollama proxy error', details: e.message })
        );
      }
    });

    // 將前端送來的 body pipe 給 Ollama
    req.pipe(proxyReq);
  } catch (e: unknown) {
    console.error('[Ollama Proxy Internal Error]', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          details: e instanceof Error ? e.message : String(e)
        })
      );
    }
  }
};
