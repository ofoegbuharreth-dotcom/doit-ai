import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.DOIT_PREVIEW_PORT ?? 4173);
const types = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const requested = normalize(join(root, pathname.replace(/^\/+/, '')));
  let file = requested.startsWith(root) ? requested : join(root, 'index.html');
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await access(file);
  } catch { file = join(root, 'index.html'); }
  response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`DOIT preview: http://127.0.0.1:${port}`));
