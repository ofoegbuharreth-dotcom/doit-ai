export function scorePatterns<T extends string>(value: string, patterns: { value: T; weight: number; pattern: RegExp; signal: string }[]) {
  const scores: Partial<Record<T, number>> = {};
  const signals: string[] = [];
  for (const item of patterns) {
    if (!item.pattern.test(value)) continue;
    scores[item.value] = (scores[item.value] ?? 0) + item.weight;
    signals.push(item.signal);
  }
  return { scores, signals, ranked: (Object.entries(scores) as [T, number][]).sort((a, b) => b[1] - a[1]) };
}
