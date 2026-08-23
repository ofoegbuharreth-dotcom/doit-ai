import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

try { loadEnvFile(path.join(process.cwd(), '.env')); } catch { /* CI supplies environment values directly. */ }

const config = {
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '',
};

const packageInfo = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'));
const releaseNotes = JSON.parse(await readFile(path.join(process.cwd(), 'release-notes.json'), 'utf8'));
const currentRelease = releaseNotes.find((item) => item.version === packageInfo.version) ?? releaseNotes[0];

if (!currentRelease) throw new Error('release-notes.json does not contain a desktop release.');

const updaterNotes = [
  currentRelease.summary,
  '',
  ...currentRelease.highlights.map((item) => `- ${item}`),
  '',
].join('\n');

await writeFile(
  path.join(process.cwd(), 'desktop', 'runtime-config.json'),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);

// electron-builder copies this into latest.yml. Supplying our own plain-text
// notes keeps update prompts readable even in clients released before the HTML
// sanitiser was added.
await writeFile(path.join(process.cwd(), 'build', 'release-notes.md'), updaterNotes, 'utf8');

console.log(`Desktop runtime configuration prepared for v${packageInfo.version}${config.sentryDsn ? ' with crash reporting' : ' (crash reporting disabled: no Sentry DSN)'}.`);
