import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const output = join(process.cwd(), 'dist');
const htmlPath = join(output, 'index.html');
const html = await readFile(htmlPath, 'utf8');
const scriptSource = html.match(/<script[^>]+src=["']([^"']+)["'][^>]*>/)?.[1];

if (!scriptSource) {
  throw new Error('Deployment blocked: dist/index.html does not reference an application bundle.');
}

const bundlePath = join(output, ...scriptSource.replace(/^\//, '').split('/'));
await access(bundlePath);
const bundle = await stat(bundlePath);

if (bundle.size < 100_000) {
  throw new Error(`Deployment blocked: ${scriptSource} is missing or unexpectedly small.`);
}

console.log(`Verified deployable web bundle: ${scriptSource} (${bundle.size} bytes).`);
