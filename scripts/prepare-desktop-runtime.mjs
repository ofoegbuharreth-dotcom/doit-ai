import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

try { loadEnvFile(path.join(process.cwd(), '.env')); } catch { /* CI supplies environment values directly. */ }

const config = {
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '',
};

await writeFile(
  path.join(process.cwd(), 'desktop', 'runtime-config.json'),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);

console.log(`Desktop runtime configuration prepared${config.sentryDsn ? ' with crash reporting' : ' (crash reporting disabled: no Sentry DSN)'}.`);
