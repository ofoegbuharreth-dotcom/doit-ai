import { buildParsedGoalClarification, parseGoal, shouldClarifyParsedGoal, type ParsedGoal } from '../../planner';

type PlanContext = Record<string, string> | undefined;
export type GoalDomain = 'roblox' | 'software' | 'money' | 'fitness' | 'sport' | 'study' | 'language' | 'habit' | 'gaming' | 'cooking' | 'speaking' | 'instrument' | 'career' | 'reading' | 'home' | 'creative' | 'travel' | 'general';
export type FitnessSubType = 'weight_loss' | 'running' | 'strength';
export type SoftwareSubType = 'build_product' | 'learn_skill';
export type GoalIntent = {
  domain: GoalDomain; confidence: number; alternatives: GoalDomain[]; outcome: string; ambiguities: string[]; parsed: ParsedGoal;
  specifics: { amount?: number; sport?: string; game?: string; instrument?: string; fitnessSubType?: FitnessSubType; softwareSubType?: SoftwareSubType; distance?: '5K' | '10K' | 'marathon' };
};

export function analyzeGoalIntent(prompt: string, context?: PlanContext): GoalIntent {
  const details = semanticGoalDetails(context);
  const parsed = parseGoal(details ? `${prompt}. ${details}` : prompt);
  const value = parsed.normalizedText;
  const domain = mapDomain(parsed, value);
  return {
    domain, confidence: parsed.confidence, alternatives: [], outcome: cleanGoalTitle(prompt), parsed,
    ambiguities: mapAmbiguities(parsed, value, domain, Boolean(details)),
    specifics: {
      amount: parsed.targetValue,
      sport: value.match(/football|basketball|tennis|boxing|swimming|cricket|rugby|golf|skating|skateboard|volleyball/)?.[0],
      game: value.match(/fortnite|valorant|minecraft|rocket league|call of duty|chess/)?.[0],
      instrument: value.match(/guitar|piano|drum|violin|singing|sing/)?.[0],
      fitnessSubType: /lose|weight loss/.test(value) ? 'weight_loss' : /run|5\s?km|10\s?km|marathon/.test(value) ? 'running' : domain === 'fitness' ? 'strength' : undefined,
      softwareSubType: /\b(build|create|develop|finish|ship|launch)\b.*\b(app|website|software|game|bot|tool)\b/.test(value) ? 'build_product' : domain === 'software' || domain === 'roblox' ? 'learn_skill' : undefined,
      distance: /marathon/.test(value) ? 'marathon' : /10\s?k(?:m)?/.test(value) ? '10K' : /5\s?k(?:m)?/.test(value) ? '5K' : undefined,
    },
  };
}

function semanticGoalDetails(context?: PlanContext) {
  const fallback = context?.additionalDetails?.split(/\r?\n/).map((item) => item.trim()).find(Boolean) ?? '';
  try {
    const transcript = JSON.parse(context?.clarificationTranscript ?? '[]') as { question?: string; answer?: string }[];
    const semanticAnswers = transcript.filter((item) => {
      const question = item.question?.toLowerCase() ?? '';
      return !/starting|right now|today|baseline|current|how much time|each week|daily|weekly|capacity/.test(question);
    }).map((item) => item.answer?.trim()).filter((answer): answer is string => Boolean(answer));
    return semanticAnswers.join('. ') || fallback;
  } catch {
    return fallback;
  }
}

export function shouldAskForClarification(intent: GoalIntent, context?: PlanContext) {
  // A clarification response is the user's explicit resolution. Never trap them
  // in a question loop; the general planner can safely use their answers even
  // when the original request was intentionally broad.
  if (context?.additionalDetails?.trim()) return false;
  return intent.ambiguities.length > 0 || shouldClarifyParsedGoal(intent.parsed);
}

export function buildClarificationMessage(intent: GoalIntent) {
  if (intent.ambiguities.includes('roblox_focus')) return 'Roblox can mean scripting, building a game, or improving at playing. One answer will stop DOIT from building the wrong plan.';
  if (intent.ambiguities.includes('fitness_focus')) return '“Get fit” can lead to very different plans. Pick the result that matters so your milestones and first session are useful.';
  if (intent.ambiguities.includes('software_focus')) return 'Coding can mean learning a skill or shipping a product. Tell DOIT which result you want before it builds the plan.';
  return buildParsedGoalClarification(intent.parsed).message;
}

export function buildClarificationQuestions(intent: GoalIntent): string[] {
  if (intent.ambiguities.includes('roblox_focus')) return ['What do you want to do in Roblox? Choose: learn Luau scripting, build and publish a game, or improve at playing.', 'Where are you starting right now?', 'How much time can you give it each week?'];
  if (intent.ambiguities.includes('fitness_focus')) return ['What is the main outcome? Choose: lose weight, run a distance, build gym strength, improve general fitness, or make a sports team.', 'Where are you starting right now?', 'How much time can you give it each week?'];
  if (intent.ambiguities.includes('software_focus')) return ['Do you want to learn a coding skill or build and ship a specific product?', 'Which language, platform, or product should the plan focus on?', 'How much time can you give it each week?'];
  return buildParsedGoalClarification(intent.parsed).questions;
}

function mapDomain(parsed: ParsedGoal, value: string): GoalDomain {
  if (/roblox|luau|roblox studio/.test(value)) return 'roblox';
  if (/football|basketball|tennis|boxing|swimming|cricket|rugby|golf|skating|skateboard|volleyball/.test(value)) return 'sport';
  if (/fortnite|valorant|minecraft|rocket league|call of duty|\bgaming\b|\bchess\b/.test(value)) return 'gaming';
  if (/guitar|piano|drum|violin|singing|\bsing\b|instrument/.test(value)) return 'instrument';
  if (/cook|bake|chef|\bmeal\b/.test(value)) return 'cooking';
  if (/speaking to people|public speak|presentation|conversation|social confidence|communicat/.test(value)) return 'speaking';
  if (/\bread\b|books?|pages?/.test(value)) return 'reading';
  if (/spanish|french|german|italian|japanese|korean|mandarin|arabic|\blanguage\b|vocabulary|fluent/.test(value)) return 'language';
  if (/clean|declutter|tidy|organise|organize|bedroom|house|home/.test(value)) return 'home';
  if (/travel|trip|holiday|vacation|visit|flight/.test(value)) return 'travel';
  if (parsed.category === 'coding' || parsed.category === 'project') return 'software';
  if (parsed.category === 'money') return 'money';
  if (parsed.category === 'fitness') return 'fitness';
  if (parsed.category === 'learning') return 'study';
  if (parsed.category === 'productivity' || (parsed.category === 'health' && /habit|sleep|meditat|stop|reduce/.test(value))) return 'habit';
  if (parsed.category === 'career') return 'career';
  if (parsed.category === 'creative') return 'creative';
  if (parsed.category === 'personal') return 'speaking';
  if (parsed.category === 'health') return 'fitness';
  return 'general';
}

function mapAmbiguities(parsed: ParsedGoal, value: string, domain: GoalDomain, hasDetails: boolean) {
  if (hasDetails) return [];
  const ambiguities: string[] = [];
  if (/roblox/.test(value) && !/luau|script|studio|build|publish|game|code/.test(value)) ambiguities.push('roblox_focus');
  if (/\b(get|become) fit\b/.test(value)) ambiguities.push('fitness_focus');
  if (domain === 'software' && /\b(code|coding|software)\b/.test(value) && !/learn|build|create|finish|app|website|python|javascript|typescript/.test(value)) ambiguities.push('software_focus');
  if (parsed.missingInformation.includes('desired_outcome') || parsed.missingInformation.includes('specific_subject')) ambiguities.push('vague_outcome');
  return [...new Set(ambiguities)];
}

function cleanGoalTitle(value: string) { return value.replace(/^(?:i\s+want\s+to|i'd\s+like\s+to|my\s+goal\s+is\s+to|i\s+need\s+to)\s+/i, '').replace(/[.!?]+$/, '').trim(); }
