import notes from '../../release-notes.json';

export type ReleaseNote = { version: string; date: string; title: string; summary: string; highlights: string[] };

export const releaseNotes = notes as ReleaseNote[];

export function parseDesktopReleaseNotes(value?: string) {
  if (!value) return { summary: 'This update includes the newest DOIT improvements and fixes.', highlights: [] as string[] };
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const summary = lines.find((line) => !line.startsWith('#') && !line.startsWith('-') && !/^Open \*\*Profile/i.test(line)) ?? 'This update includes the newest DOIT improvements and fixes.';
  const highlights = lines.filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, '')).slice(0, 5);
  return { summary, highlights };
}
