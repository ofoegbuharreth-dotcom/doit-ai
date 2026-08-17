import { NORMALIZATION_REPLACEMENTS } from '../data/synonyms';

export function normalizeGoalText(input: string) {
  let value = input.normalize('NFKC').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of NORMALIZATION_REPLACEMENTS) value = value.replace(pattern, replacement);
  return value.replace(/\s+([,.!?])/g, '$1').trim();
}
