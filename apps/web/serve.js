import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST_DIR = '/app/dist';
const PORT = parseInt(process.env.PORT || '8080', 10);

const MIME_TYPES = /** @type {const} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
});

const indexHtml = await readFile(join(DIST_DIR, 'index.html'));

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/healthcheck') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // Try to serve the requested file
  const filePath = join(DIST_DIR, url.pathname);
  try {
    const stats = await stat(filePath);
    if (stats.isFile()) {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const headers = { 'Content-Type': contentType };

      // Immutable caching for hashed assets (Vite output in /assets/)
      if (url.pathname.startsWith('/assets/')) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      }

      const content = await readFile(filePath);
      res.writeHead(200, headers);
      return res.end(content);
    }
  } catch {
    // File not found — fall through to SPA fallback
  }

  // SPA fallback — serve index.html for all unmatched routes
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(indexHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving on port ${PORT}`);
});
