import { CATEGORY_PATTERNS, INTENT_PATTERNS } from '../data/keywords';
import { SUBJECT_ALIASES } from '../data/synonyms';
import type { GoalCategory, GoalIntent, GoalShape, ParsedGoal } from '../types';
import { extractDeadline, extractFrequency, extractTarget, wordsToNumbers } from './extractors';
import { normalizeGoalText } from './normalize';
import { scorePatterns } from './score';

export function parseGoal(input: string): ParsedGoal {
  const originalText = input.trim();
  const normalizedText = wordsToNumbers(normalizeGoalText(originalText));
  const intentResult = scorePatterns(normalizedText, INTENT_PATTERNS);
  const categoryResult = scorePatterns(normalizedText, CATEGORY_PATTERNS);
  tuneScores(normalizedText, intentResult.scores, categoryResult.scores);
  const intent = topValue(intentResult.scores, 'unknown');
  const category = topValue(categoryResult.scores, 'other');
  const target = extractTarget(normalizedText);
  const deadline = extractDeadline(normalizedText);
  const frequency = extractFrequency(normalizedText);
  const subject = extractSubject(normalizedText, intent, deadline.raw, target.raw);
  const shape = inferShape(normalizedText, category, intent, target.targetValue, target.targetUnit);
  const missingInformation = findMissingInformation({ normalizedText, category, intent, subject, targetValue: target.targetValue, deadline, shape });
  const topIntent = Math.max(0, ...Object.values(intentResult.scores));
  const topCategory = Math.max(0, ...Object.values(categoryResult.scores));
  const specificity = [subject.length > 2, target.targetValue !== undefined, deadline.kind !== 'none', frequency !== undefined].filter(Boolean).length;
  const confidence = Math.max(0.08, Math.min(0.99, 0.22 + topIntent / 24 + topCategory / 28 + specificity * 0.06 - missingInformation.length * 0.08));
  return {
    originalText, normalizedText, category, intent, subject,
    targetValue: target.targetValue, targetUnit: target.targetUnit,
    deadline, frequency, shape, confidence: Math.round(confidence * 100) / 100,
    missingInformation, categoryScores: categoryResult.scores, intentScores: intentResult.scores,
    signals: [...intentResult.signals, ...categoryResult.signals],
  };
}

function tuneScores(value: string, intents: Partial<Record<GoalIntent, number>>, categories: Partial<Record<GoalCategory, number>>) {
  if (/\bmake\s+(?:£|\$|€|\d)|\bearn money\b|\bselling\b/.test(value)) intents.earn = (intents.earn ?? 0) + 8;
  if (/\bmake\s+(?:an?\s+)?(?:app|website|game|product|tool)\b/.test(value)) intents.build = (intents.build ?? 0) + 8;
  if (/\bfinish\b.*\b(app|website|project|course)\b/.test(value)) intents.finish = (intents.finish ?? 0) + 8;
  if (/\b(revise|gcse|exam)\b/.test(value)) intents.prepare = (intents.prepare ?? 0) + 5;
  if (/\b(speaking to people|communicat|social confidence|conversation)\b/.test(value)) { categories.personal = (categories.personal ?? 0) + 12; categories.learning = Math.max(0, (categories.learning ?? 0) - 5); }
  if (/\bfootball team\b/.test(value)) { categories.fitness = (categories.fitness ?? 0) + 5; intents.prepare = (intents.prepare ?? 0) + 12; }
  if (/\bpages?\b/.test(value)) { categories.learning = (categories.learning ?? 0) + 4; intents.learn = (intents.learn ?? 0) + 8; }
  if (/\b(?:run|walk|cycle|swim)\b.*\d/.test(value)) intents.improve = (intents.improve ?? 0) + 8;
  if (/\bapp|website|software|game\b/.test(value) && /\bcode|coding|python|javascript|typescript|luau\b/.test(value)) categories.coding = (categories.coding ?? 0) + 4;
  if (/\b(lose|drop)\b.*\b(pounds?|lb|kg|kilograms?|weight)\b/.test(value)) { categories.health = (categories.health ?? 0) + 15; categories.money = 0; }
  if (/\b(?:i\s+have|complete|do|submit)?\s*\d+\s*(?:assignments?|homework|coursework|essays?|tasks?|reports?)\b/.test(value)) intents.finish = (intents.finish ?? 0) + 14;
}

function findMissingInformation(input: Pick<ParsedGoal, 'normalizedText' | 'category' | 'intent' | 'subject' | 'targetValue' | 'deadline' | 'shape'>) {
  const missing: string[] = [];
  if (input.intent === 'unknown' && input.shape === 'open' && input.category === 'other') missing.push('desired_outcome');
  if (!input.subject || /^(it|myself|everything|anything|life|improve|better|finish|start)$/.test(input.subject)) missing.push('specific_subject');
  if (input.intent === 'earn' && input.targetValue === undefined) missing.push('target_amount');
  if (input.intent === 'earn' && !/\b(sell|selling|freelance|job|business|client|service|product)\b/.test(input.normalizedText)) missing.push('earning_method');
  if (input.normalizedText === 'i want to get fit' || /\b(get|become) fit\b/.test(input.normalizedText)) missing.push('fitness_outcome');
  if (input.shape === 'backlog' && input.deadline.kind === 'none' && !/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|\d{1,2}[/-]\d{1,2})\b/.test(input.normalizedText)) missing.push('backlog_details');
  if (/\b(amazing|awesome|everything|anything|somehow|better life|my life)\b/.test(input.normalizedText)) missing.push('desired_outcome', 'starting_point', 'available_time');
  return [...new Set(missing)].slice(0, 3);
}

function extractSubject(value: string, intent: GoalIntent, deadlineRaw: string, targetRaw?: string) {
  if (/\b(assignments?|homework|coursework|essays?)\b/.test(value)) return value.match(/\b(assignments?|homework|coursework|essays?)\b/)?.[0] ?? 'assignments';
  let subject = value
    .replace(/^(?:i\s+(?:want|need|would like)\s+to|i\s+have|my goal is to)\s+/, '')
    .replace(new RegExp(`^${intent === 'unknown' ? '' : intent}\\s+`), '')
    .replace(/^(?:improve at|become better at|be better at|get fit|become fit)\s+/, '')
    .replace(deadlineRaw, '').replace(targetRaw ?? '', '')
    .replace(/\b(?:in order to|so that i can)\b.*$/, '')
    .replace(/\s+/g, ' ').replace(/^[\s,.]+|[\s,.!?]+$/g, '').trim();
  for (const [alias, replacement] of Object.entries(SUBJECT_ALIASES)) subject = subject.replace(alias, replacement);
  if (!subject && /\bsave\b/.test(value)) subject = 'money';
  return subject;
}

function inferShape(value: string, category: GoalCategory, intent: GoalIntent, targetValue?: number, targetUnit?: string): GoalShape {
  if (/\b(assignments?|homework|coursework|essays?)\b/.test(value) && /\b(due|have)\b/.test(value)) return 'backlog';
  if (/\b(tasks?|reports?)\b/.test(value) && /\bdue\b/.test(value)) return 'backlog';
  if (category === 'money' || intent === 'earn' || intent === 'save') return 'financial';
  if (intent === 'prepare' || /\b(team|exam|interview|audition|competition|test)\b/.test(value)) return 'performance';
  if (targetValue !== undefined && targetUnit) return 'quantity';
  if (intent === 'build' || intent === 'finish' && /\b(app|website|project|product|book|course)\b/.test(value)) return 'project';
  if (intent === 'start' || intent === 'reduce' || intent === 'maintain' || category === 'productivity') return 'habit';
  if (category === 'health' || /\b(sleep|stress|weight|health|diet)\b/.test(value)) return 'wellbeing';
  if (intent === 'learn' || intent === 'improve' || category === 'learning' || category === 'coding' || category === 'personal') return 'skill';
  return 'open';
}

function topValue<T extends string>(scores: Partial<Record<T, number>>, fallback: T) {
  return ((Object.entries(scores) as [T, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback);
}
