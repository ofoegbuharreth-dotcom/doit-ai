import type { GoalDeadline, GoalFrequency } from '../types';

const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function wordsToNumbers(value: string) {
  const tokens = value.split(/([\s-]+)/);
  let total = 0;
  let current = 0;
  let consuming = false;
  const output: string[] = [];
  const flush = () => { if (consuming) output.push(String(total + current)); total = 0; current = 0; consuming = false; };
  for (const token of tokens) {
    const word = token.toLowerCase().trim();
    if (!word) { if (!consuming) output.push(token); continue; }
    if (SMALL[word] !== undefined) { current += SMALL[word]; consuming = true; continue; }
    if (word === 'hundred' && consuming) { current = Math.max(1, current) * 100; continue; }
    if (word === 'thousand' && consuming) { total += Math.max(1, current) * 1000; current = 0; continue; }
    flush(); output.push(token);
  }
  flush();
  return output.join('').replace(/\s+/g, ' ').trim();
}

export function extractTarget(value: string) {
  const numbered = wordsToNumbers(value);
  const matches = [...numbered.matchAll(/(?:£|\$|€)?\s*(\d[\d,]*(?:\.\d+)?)\s*(pounds?|gbp|dollars?|usd|euros?|eur|kg|kilograms?|lb|pounds? lost|km|kilometres?|miles?|pages?|books?|hours?|minutes?|sales?|client reports?|job applications?|course lessons?|clients?|assignments?|tasks?|reports?|essays?|chapters?|lessons?|courses?|applications?|projects?|items?|videos?|articles?|workouts?|sessions?|photos?|pictures?|emails?|files?|leads?|customers?|words?|meals?|songs?|drawings?|jobs?)?/g)]
    .map((match) => ({ value: Number(match[1]?.replace(/,/g, '')), unit: normalizeUnit(match[2], match[0]), raw: match[0] }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0 && !/\b(week|month|day|year)s?\b/.test(item.unit ?? ''));
  const meaningful = matches.find((item) => item.unit) ?? matches[0];
  return meaningful ? { targetValue: meaningful.value, targetUnit: meaningful.unit, raw: meaningful.raw } : {};
}

export function extractDeadline(value: string, now = new Date()): GoalDeadline {
  const duration = value.match(/\b(?:in|within|over)\s+(\d+)\s*(days?|weeks?|months?)\b/);
  if (duration) {
    const amount = Number(duration[1]);
    const unit = duration[2] ?? 'days';
    const durationDays = amount * (unit.startsWith('week') ? 7 : unit.startsWith('month') ? 30 : 1);
    const date = new Date(now); date.setDate(date.getDate() + durationDays);
    return { kind: 'duration', raw: duration[0], durationDays, date: date.toISOString().slice(0, 10) };
  }
  if (/\bthis month\b/.test(value)) {
    const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { kind: 'month', raw: 'this month', date: localDate(date) };
  }
  const monthMatch = value.match(new RegExp(`\\b(?:before|by)\\s+(${MONTHS.join('|')})(?:\\s+(\\d{4}))?\\b`));
  if (monthMatch) {
    const month = MONTHS.indexOf(monthMatch[1]!);
    let year = monthMatch[2] ? Number(monthMatch[2]) : now.getFullYear();
    if (!monthMatch[2] && month < now.getMonth()) year += 1;
    const date = new Date(year, month, 1);
    return { kind: 'month', raw: monthMatch[0], date: localDate(date) };
  }
  const iso = value.match(/\b(?:by|before)\s+(20\d{2}-\d{2}-\d{2})\b/);
  return iso ? { kind: 'date', raw: iso[0], date: iso[1] } : { kind: 'none', raw: '' };
}

export function extractFrequency(value: string): GoalFrequency | undefined {
  if (/\b(daily|every day|each day)\b/.test(value)) return { raw: RegExp.lastMatch, count: 1, period: 'day' };
  const match = value.match(/\b(\d+)\s*(?:times?|sessions?)\s*(?:a|per|each)\s*(day|week|month)\b/);
  if (match) return { raw: match[0], count: Number(match[1]), period: match[2] as GoalFrequency['period'] };
  if (/\bweekly|every week\b/.test(value)) return { raw: RegExp.lastMatch, count: 1, period: 'week' };
  return undefined;
}

function normalizeUnit(unit?: string, raw = '') {
  if (/£|pounds?|gbp/i.test(`${raw} ${unit ?? ''}`)) return '£';
  if (/\$|dollars?|usd/i.test(`${raw} ${unit ?? ''}`)) return '$';
  if (/€|euros?|eur/i.test(`${raw} ${unit ?? ''}`)) return '€';
  if (!unit) return undefined;
  if (/kilomet/.test(unit)) return 'km';
  if (/page/.test(unit)) return 'pages';
  if (/book/.test(unit)) return 'books';
  if (/assignment/.test(unit)) return 'assignments';
  if (/application/.test(unit)) return 'applications';
  if (/course lessons?/.test(unit)) return 'lessons';
  if (/client reports?/.test(unit)) return 'reports';
  const countable = /^(task|report|essay|chapter|lesson|course|project|item|video|article|workout|session|photo|picture|email|file|lead|customer|word|meal|song|drawing|job)s?$/;
  return unit.replace(/s$/, '') + (countable.test(unit) ? 's' : '');
}

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
