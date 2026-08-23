import notes from '../../release-notes.json';

export type ReleaseNote = { version: string; date: string; title: string; summary: string; highlights: string[] };

export const releaseNotes = notes as ReleaseNote[];

function decodeReleaseEntities(value: string) {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, entity: string) => named[entity.toLowerCase()] ?? match);
}

function normaliseReleaseBody(value: string) {
  const structured = value
    .replace(/<\s*h[1-6][^>]*>/gi, '\n# ')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|ul|ol|section)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeReleaseEntities(structured)
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export function parseDesktopReleaseNotes(value?: string) {
  if (!value) return { summary: 'This update includes the newest DOIT improvements and fixes.', highlights: [] as string[] };
  const lines = normaliseReleaseBody(value).split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const summary = lines.find((line) => !line.startsWith('#') && !line.startsWith('-') && !/^Open Profile/i.test(line)) ?? 'This update includes the newest DOIT improvements and fixes.';
  const highlights = lines.filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, '')).slice(0, 5);
  return { summary, highlights };
}

export function compactReleaseSummary(value: string, maxLength = 165) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const sentence = clean.slice(0, maxLength + 1).match(/^(.{40,}?[.!?])(?:\s|$)/)?.[1];
  if (sentence) return sentence;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}
