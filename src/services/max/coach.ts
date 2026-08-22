import type { MaxPortfolio } from './intelligence';
import { selectMaxWork } from './intelligence';

export function answerMaxCoach(request: string, portfolio: MaxPortfolio) {
  const value = request.toLowerCase();
  const available = Number(value.match(/(\d{1,3})\s*(?:min|minute)/)?.[1] ?? 0) || (Number(value.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)/)?.[1] ?? 0) * 60);
  if (/what should i work on|what next|prioriti[sz]e|only have|tonight|today/.test(value)) {
    const selected = selectMaxWork(portfolio, available || 60);
    if (!selected.length) return 'Your active plan is clear. Add a useful action or use the free space for recovery.';
    const list = selected.map((item, index) => `${index + 1}. “${item.task.title}” (${item.task.estimatedMinutes || 25} min) — ${item.reasons[0]}`).join('\n');
    return `Based on every active goal${available ? ` and your ${available} minutes` : ''}, this is the strongest order:\n${list}`;
  }
  if (/falling behind|fix this week|behind|still hit|deadline|on track/.test(value)) {
    const behind = portfolio.forecasts.filter((item) => item.status === 'behind');
    if (!behind.length) return `No deadline goal is currently behind. ${portfolio.overloadedDays.length ? `${portfolio.overloadedDays.length} day${portfolio.overloadedDays.length === 1 ? '' : 's'} look overloaded, so protect the highest-ranked actions first.` : 'Your current workload looks achievable from the data DOIT has.'}`;
    const reviewContext = portfolio.recentReview?.blockers?.[0] ? ` Your latest weekly review named this blocker: ${portfolio.recentReview.blockers[0]}.` : '';
    return `${behind.map((item) => `“${item.goal.title}” is behind at ${item.progress}%. It needs about ${item.requiredWeeklyProgress} ${item.goal.unit} per week to reach ${item.goal.targetDate}.`).join('\n')}${reviewContext} Review the proposed rebuilds before applying anything.`;
  }
  return undefined;
}
