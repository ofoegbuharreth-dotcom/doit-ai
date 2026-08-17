import type { GoalCategory, GoalIntent } from '../types';

type WeightedPattern<T extends string> = { value: T; weight: number; pattern: RegExp; signal: string };

export const INTENT_PATTERNS: WeightedPattern<GoalIntent>[] = [
  { value: 'save', weight: 10, pattern: /\b(save|saving|put aside|emergency fund)\b/, signal: 'saving language' },
  { value: 'earn', weight: 10, pattern: /\b(earn|income|revenue|sell|selling|freelance|side hustle)\b/, signal: 'earning language' },
  { value: 'finish', weight: 10, pattern: /\b(finish|complete|ship|deliver|submit)\b/, signal: 'completion language' },
  { value: 'prepare', weight: 9, pattern: /\b(prepare|revise|study for|practice for|ready for)\b/, signal: 'preparation language' },
  { value: 'build', weight: 9, pattern: /\b(build|create|develop|make|launch|publish|design|plan|arrange|set up)\b/, signal: 'creation language' },
  { value: 'finish', weight: 8, pattern: /\b(organize|organise|sort|process|clear)\b/, signal: 'completion workflow language' },
  { value: 'learn', weight: 9, pattern: /\b(learn|understand|master|study)\b/, signal: 'learning language' },
  { value: 'reduce', weight: 9, pattern: /\b(stop|quit|reduce|cut down|less|lose)\b/, signal: 'reduction language' },
  { value: 'increase', weight: 8, pattern: /\b(increase|grow|gain|raise|more)\b/, signal: 'growth language' },
  { value: 'start', weight: 8, pattern: /\b(start|begin|take up)\b/, signal: 'starting language' },
  { value: 'maintain', weight: 8, pattern: /\b(maintain|keep|continue|stay)\b/, signal: 'maintenance language' },
  { value: 'improve', weight: 7, pattern: /\b(improve|better|best|stronger|fitter|confident|good at)\b/, signal: 'improvement language' },
];

export const CATEGORY_PATTERNS: WeightedPattern<GoalCategory>[] = [
  { value: 'coding', weight: 10, pattern: /\b(python|javascript|typescript|coding|programming|scripting|luau|developer)\b/, signal: 'coding subject' },
  { value: 'project', weight: 9, pattern: /\b(app|website|software|saas|product|portfolio|game|bot|tool)\b/, signal: 'project deliverable' },
  { value: 'money', weight: 10, pattern: /(?:£|\$|€)|\b(money|pounds?|dollars?|euros?|income|revenue|budget|debt|sell|selling|savings?)\b/, signal: 'money subject' },
  { value: 'fitness', weight: 9, pattern: /\b(gym|fitness|fit|football|soccer|basketball|tennis|boxing|run|running|5\s?km|10\s?km|marathon|strength|muscle|workout|exercise)\b/, signal: 'fitness or sport subject' },
  { value: 'learning', weight: 9, pattern: /\b(gcse|exam|grades?|maths|math|school|college|courses?|assignments?|homework|coursework|essays?|language|spanish|french|books?|read|pages?|revision|study)\b/, signal: 'learning subject' },
  { value: 'productivity', weight: 10, pattern: /\b(procrastinat\w*|focus|productive|productivity|routine|habit|organis\w*|organiz\w*|time management|screen time)\b/, signal: 'productivity subject' },
  { value: 'career', weight: 9, pattern: /\b(job|career|interview|cv|resume|promotion|client|business|freelance)\b/, signal: 'career subject' },
  { value: 'personal', weight: 10, pattern: /\b(speaking to people|conversation|social|confidence|communicat|relationship|friends?)\b/, signal: 'personal development subject' },
  { value: 'creative', weight: 9, pattern: /\b(write|drawing|draw|paint|song|music|video|film|podcast|novel|art|design)\b/, signal: 'creative subject' },
  { value: 'health', weight: 9, pattern: /\b(health|sleep|weight|diet|nutrition|meditat|stress|anxiety)\b/, signal: 'health subject' },
];
