import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const requestedVersion = String(process.argv[2] ?? '').replace(/^v/i, '');
const output = path.resolve(process.argv[3] ?? 'release-body.md');
const notes = JSON.parse(await readFile(path.resolve('release-notes.json'), 'utf8'));
const release = notes.find((item) => item.version === requestedVersion) ?? notes[0];
if (!release) throw new Error('release-notes.json does not contain a release.');

const body = [`# ${release.title}`, '', release.summary, '', '## What’s new', '', ...release.highlights.map((item) => `- ${item}`), '', 'Open **Profile → Version logs** inside DOIT AI to see the full update history.', ''].join('\n');
await writeFile(output, body, 'utf8');
console.log(`Created release notes for v${release.version}: ${output}`);
