import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = normalize(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4173);
const mime = { '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webp': 'image/webp' };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host}`).pathname);
  const requested = normalize(join(root, pathname));
  const safe = requested.startsWith(root) ? requested : join(root, 'index.html');
  const file = existsSync(safe) && statSync(safe).isFile() ? safe : join(root, 'index.html');
  response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Static site ready at http://127.0.0.1:${port}`));
