import { cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const output = join(process.cwd(), 'dist');
const expoOutput = join(output, '_expo');
const cloudflareOutput = join(output, 'expo-static');
const generatedNodeModules = join(output, 'assets', 'node_modules');
const vendorOutput = join(output, 'assets', 'vendor');
const htmlPath = join(output, 'index.html');

await rm(cloudflareOutput, { recursive: true, force: true });
await cp(expoOutput, cloudflareOutput, { recursive: true });
await rm(expoOutput, { recursive: true, force: true });

// Wrangler deliberately ignores any directory named `node_modules`, even when
// Expo places browser font assets inside dist/assets/node_modules. Move those
// generated assets to a deployable name and rewrite their URLs in the bundle.
await rm(vendorOutput, { recursive: true, force: true });
await cp(generatedNodeModules, vendorOutput, { recursive: true });
await rm(generatedNodeModules, { recursive: true, force: true });

const html = await readFile(htmlPath, 'utf8');
await writeFile(htmlPath, html.replaceAll('/_expo/', '/expo-static/'), 'utf8');

async function rewriteBundleAssetPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return rewriteBundleAssetPaths(path);
    if (!entry.name.endsWith('.js')) return;
    const source = await readFile(path, 'utf8');
    await writeFile(path, source.replaceAll('assets/node_modules/', 'assets/vendor/'), 'utf8');
  }));
}

async function findFiles(directory, matches) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(path, matches);
    return matches(entry.name) ? [path] : [];
  }));
  return found.flat();
}

await rewriteBundleAssetPaths(cloudflareOutput);

const preparedBundles = await findFiles(cloudflareOutput, (name) => name.endsWith('.js'));
if (preparedBundles.length === 0) {
  throw new Error('Cloudflare web preparation failed: no JavaScript bundle was copied to dist/expo-static.');
}

await Promise.all(preparedBundles.map(async (bundlePath) => {
  const bundle = await stat(bundlePath);
  if (bundle.size === 0) {
    throw new Error(`Cloudflare web preparation failed: ${bundlePath} is empty.`);
  }
}));

console.log('Prepared Cloudflare-safe web assets in dist/expo-static and dist/assets/vendor.');
