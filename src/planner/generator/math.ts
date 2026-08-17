import type { ParsedGoal } from '../types';

export function calculateCadence(parsed: ParsedGoal) {
  if (!parsed.targetValue || !parsed.deadline.durationDays) return undefined;
  const weeks = Math.max(1, parsed.deadline.durationDays / 7);
  const weekly = parsed.targetValue / weeks;
  return { weekly: roundUseful(weekly), daily: roundUseful(parsed.targetValue / Math.max(1, parsed.deadline.durationDays)) };
}

export function validateGoalFeasibility(parsed: ParsedGoal) {
  const cadence = calculateCadence(parsed);
  if (!cadence || !parsed.targetUnit) return [];
  const warnings: string[] = [];
  if (['£', '$', '€'].includes(parsed.targetUnit) && cadence.weekly > 5000) warnings.push('That requires an unusually high weekly amount. Consider a longer deadline or a smaller first target.');
  if (parsed.targetUnit === 'pages' && cadence.daily > 300) warnings.push('That reading pace is likely unrealistic. Consider extending the deadline or reducing the page target.');
  if (parsed.targetUnit === 'km' && cadence.daily > 40) warnings.push('That distance increase may be unsafe without a longer build-up.');
  return warnings;
}

function roundUseful(value: number) { return value >= 10 ? Math.ceil(value) : Math.ceil(value * 10) / 10; }
