import type { GeneratedMilestone, GeneratedTask, GoalPlanResponse } from '@/types';
import { INTENT_TEMPLATES, type ParsedGoal } from '../../planner';
import { analyzeGoalIntent, shouldAskForClarification, type GoalDomain, type GoalIntent } from './goal-intent';
import { isGoalPlanResponse } from './validation';

type PlanContext = Record<string, string> | undefined;
type PlanSpec = GoalPlanResponse;

let activePlanContext: PlanContext;

export function buildGoalPlan(prompt: string, context?: PlanContext): GoalPlanResponse {
  const raw = prompt.trim();
  activePlanContext = context;
  const value = `${raw} ${context?.additionalDetails ?? ''}`.toLowerCase();
  const title = cleanGoalTitle(raw);
  const intent = analyzeGoalIntent(prompt, context);
  const useShapeFirst = intent.parsed.shape === 'wellbeing' || intent.parsed.shape === 'quantity' && isReusableQuantityUnit(intent.parsed.targetUnit);
  const plan = useShapeFirst
    ? buildShapePlan(intent.parsed, title, context)
    : buildPlanForIntent(intent, value, title, context) ?? buildShapePlan(intent.parsed, title, context);

  if (!isGoalPlanResponse(plan)) throw new Error('The generated plan was invalid. Try again.');
  return plan;
}

export function shouldClarifyGoal(prompt: string, context?: PlanContext) {
  return shouldAskForClarification(analyzeGoalIntent(prompt, context), context);
}

function buildPlanForIntent(intent: GoalIntent, value: string, title: string, context?: PlanContext): PlanSpec | null {
  const builders: Record<GoalDomain, () => PlanSpec | null> = {
    roblox: () => robloxLuauPlan(value, title, context),
    software: () => softwarePlan(value, title, context),
    money: () => moneyPlan(value, title, context),
    fitness: () => fitnessPlan(value, title, context),
    sport: () => sportPlan(value, title, context),
    study: () => studyPlan(value, title, context),
    language: () => languagePlan(value, title, context),
    habit: () => habitPlan(value, title, context),
    gaming: () => gamingPlan(value, title, context),
    cooking: () => cookingPlan(value, title, context),
    speaking: () => speakingPlan(value, title, context),
    instrument: () => instrumentPlan(value, title, context),
    career: () => careerPlan(value, title, context),
    reading: () => readingPlan(value, title, context),
    home: () => homePlan(value, title, context),
    creative: () => creativePlan(value, title, context),
    travel: () => travelPlan(value, title, context),
    general: () => null,
  };
  return builders[intent.domain]?.() ?? null;
}

export function buildGoalNextTasks(goalTitle: string, goalDescription: string, context?: PlanContext) {
  return buildGoalPlan(`${goalTitle}. ${goalDescription}`, context).todayTasks;
}

function robloxLuauPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/roblox|luau|roblox studio/.test(value)) return null;
  return plan(
    /best|master|expert|better|improve/.test(value) ? 'Build advanced Roblox Luau skills' : sentenceCase(title),
    `Build and explain four production-style Roblox systems using typed Luau, secure client-server boundaries, persistence, and multiplayer testing${deadline(context)}. Progress counts only when a system works in a published test place and its decisions can be explained.`,
    4,
    'working Roblox systems',
    [
      milestone('Interactive system works across client and server', 'A UI or world interaction sends a RemoteEvent, the server validates the request, and every player sees the correct result.', 1),
      milestone('Player data saves and loads safely', 'A versioned DataStore profile survives leave/rejoin tests and handles failed requests without wiping progress.', 2),
      milestone('Multiplayer round or ability system is complete', 'The server owns game state, rejects invalid client requests, cleans up connections, and works with at least two test clients.', 3),
      milestone('Published vertical slice passes five playtests', 'Five real play sessions reach the main outcome without a critical error; feedback and server logs drive the final fixes.', 4),
    ],
    [
      task('Build a secure RemoteEvent interaction', 'In a fresh Roblox Studio place, create one button or ProximityPrompt. A LocalScript sends one requested action; a server Script validates the player, distance or cooldown, changes the authoritative state, and returns success to the UI. Test it with two players.', 'high', 50),
      task('Trace and explain the client-server flow', 'Add comments at the input, RemoteEvent, server validation, state change, and UI response. Then disable one validation check, describe the exploit it permits, and restore the check.', 'high', 25),
      task('Create a four-system build queue', 'Write one shippable project for each milestone: interaction, saved data, multiplayer gameplay, and published vertical slice. Give each a visible done condition and choose the exact system you will build next.', 'medium', 15),
    ],
    'Strong Luau developers do more than write syntax: they decide what the client may request, what the server must own, how data can fail, and how the system behaves with several players.',
  );
}

function moneyPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (/(?:lose|drop)\D{0,20}\d[\d,.]*\s*(?:pounds?|lb)|body\s*weight|weight\s*loss/.test(value)) return null;
  if (!/save|saving|money|pound|gbp|£|dollar|\$|euro|€|debt|budget|deposit|emergency fund/.test(value)) return null;
  const amount = parseLargestNumber(value) ?? 1000;
  const unit = detectCurrency(value);
  if (/\b(earn|income|revenue|sell|selling|freelance|side hustle)\b/.test(value)) {
    const selling = /\b(sell|selling|clothes|items|products?)\b/.test(value);
    const firstTarget = Math.max(1, Math.ceil(amount * 0.1));
    return plan(
      `Earn ${formatValue(amount, unit)}${selling ? ' selling products' : ''}`,
      `Earn ${formatValue(amount, unit)} in recorded revenue through a repeatable offer, outreach, and delivery system${deadline(context)}. Progress counts when a customer payment clears.`,
      amount,
      `${unit} earned`,
      [
        milestone(`Offer ready and first ${selling ? 'five listings' : 'five prospects'} complete`, 'The buyer, offer, price, proof, and delivery method are clear enough for a real person to buy.', Math.max(1, amount * 0.02)),
        milestone(`First ${formatValue(firstTarget, unit)} earned`, 'At least one real customer has paid and the full selling and delivery process has been completed.', firstTarget),
        milestone(`${formatValue(amount * 0.5, unit)} earned with a repeatable channel`, 'The best source of buyers is known and the sales steps can be repeated without rebuilding everything.', amount * 0.5),
        milestone(`${formatValue(amount, unit)} earned and reviewed`, 'The revenue target is complete and costs, profit, conversion rate, and the next decision are recorded.', amount),
      ],
      selling ? [
        task('Choose the first 10 items to sell', 'Pick items with clear condition and demand. Record the item, condition, likely price, minimum price, and where you will list it.', 'high', 20),
        task('Publish three complete listings', 'Use bright photos, exact measurements or condition, a searchable title, honest flaws, price, and delivery details. Publish all three.', 'high', 35),
        task('Set the sales scoreboard', 'Track listings live, views, messages, offers, sales, fees, and revenue so the next action comes from evidence.', 'medium', 10),
      ] : [
        task('Define one buyer and one paid outcome', 'Name a specific person or business, the painful problem, the result you can deliver, the timeframe, and an opening price.', 'high', 20),
        task('Find five qualified prospects', 'Save five real people who show evidence of needing the result. Write one reason each is a fit.', 'high', 25),
        task('Send the first personalised offer', 'Reference one true detail, state the useful result, show relevant proof, and ask one low-friction question.', 'high', 15),
      ],
      'Revenue goals need both a number and a sales system. Track offers and conversion as leading indicators, while only cleared customer payments move the goal total.',
    );
  }
  const first = Math.max(1, Math.ceil(amount * 0.05));
  const weekly = weeklyAmount(amount, context?.targetDate);
  return plan(
    sentenceCase(title),
    `Save ${formatValue(amount, unit)} in a dedicated pot. Progress is the total amount deposited${deadline(context)}.`,
    amount,
    unit,
    [
      milestone(`${formatValue(amount * 0.1, unit)} saved and the system is running`, 'The dedicated pot exists and at least one automatic or manual deposit has cleared.', amount * 0.1),
      milestone(`${formatValue(amount * 0.25, unit)} saved`, 'A quarter of the target is protected in the goal pot, separate from spending money.', amount * 0.25),
      milestone(`${formatValue(amount * 0.5, unit)} saved`, 'Half the target is secured and the weekly deposit has been reviewed against the deadline.', amount * 0.5),
      milestone(`${formatValue(amount, unit)} fully saved`, 'The complete target is available in the dedicated pot.', amount),
    ],
    [
      task('Create the dedicated savings pot', 'Open or rename a separate savings account for this goal. Finish when it has a clear name and no everyday spending comes from it.', 'high', 10),
      task(`Transfer the first ${formatValue(first, unit)}`, `Move ${formatValue(first, unit)} into the pot today and record that exact deposit in DOIT.`, 'high', 5),
      task(`Set a ${formatValue(weekly, unit)} weekly transfer`, 'Create a standing order for the day after you are normally paid. Finish when the first scheduled date is visible.', 'medium', 10),
    ],
    `At ${formatValue(weekly, unit)} per week, the target has a repeatable system. If that amount is unrealistic, change the deadline or target before missing transfers.`,
  );
}

function fitnessPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/fitness|fit|workout|gym|strong|strength|lift|run|marathon|5k|10k|weight|muscle|steps|exercise|push.?up|(?:lose|drop).*?(?:pounds?|\blb\b)/.test(value)) return null;
  if (/lose|weight loss|drop \d|kg|kilogram|pounds? of weight/.test(value)) {
    const target = parseLargestNumber(value) ?? 5;
    const imperial = /(?:pounds?|\blb\b)/.test(value);
    const unit = imperial ? 'lb lost' : 'kg lost';
    const amountLabel = imperial ? 'lb' : 'kg';
    return plan(
      `Lose ${target} ${amountLabel} sustainably`,
      `Lose ${target} ${amountLabel} while protecting strength and energy. Progress uses a seven-day weight average, not one-day scale changes${deadline(context)}.`,
      target,
      unit,
      ratioMilestones(target, [0.15, 0.35, 0.65, 1], (amount, index) => [
        `${pretty(amount)} ${amountLabel} lost with two consistent weeks`,
        `${pretty(amount)} ${amountLabel} lost and routines feel repeatable`,
        `${pretty(amount)} ${amountLabel} lost while strength is maintained`,
        `${pretty(amount)} ${amountLabel} lost and maintenance begins`,
      ][index]!, [
        'Log seven morning weigh-ins and follow the planned meals and movement for two weeks.',
        'Maintain the routine without extreme restriction and review the weekly average.',
        'Keep training performance broadly stable while the trend continues downward.',
        'Reach the target trend, then hold the new average for two weeks.',
      ]),
      [
        task('Record today’s starting measurements', 'Record body weight under normal conditions, waist measurement, and one front/side photo. These are private baseline data—not a judgement.', 'high', 10),
        task('Plan tomorrow’s three main meals', 'Write the protein source, fruit or vegetable, and approximate portion for breakfast, lunch, and dinner. Finish when no meal is left to chance.', 'high', 15),
        task('Schedule three movement sessions this week', `Choose exact days and times for two strength sessions and one longer walk or cardio session.${timeNote(context)}`, 'medium', 10),
      ],
      'Judge progress from weekly averages and repeatable behaviours. If weight, food, or exercise is affecting your health, involve a qualified clinician.',
    );
  }
  if (/run|5k|10k|marathon/.test(value)) {
    const distance = /marathon/.test(value) ? 'marathon' : /10k/.test(value) ? '10K' : '5K';
    const runs = distance === 'marathon' ? 36 : distance === '10K' ? 24 : 18;
    return plan(
      `Run a ${distance} confidently`,
      `Complete ${runs} logged training runs and finish a ${distance} continuously or with the planned run-walk strategy${deadline(context)}.`,
      runs,
      'runs',
      [
        milestone('Three easy runs completed', 'Complete three conversational-pace sessions and record time, distance, and effort after each.', 3),
        milestone(`${distance === '5K' ? '3 km' : distance === '10K' ? '5 km' : '10 km'} long run completed`, 'Finish the distance at an easy pace without pain that changes your movement.', Math.round(runs * 0.35)),
        milestone('Training week completed without skipped recovery', 'Complete the planned easy, quality, and long sessions while keeping rest days.', Math.round(runs * 0.7)),
        milestone(`${distance} completed`, `Finish the full ${distance} and record the result.`, runs),
      ],
      [
        task('Complete a 20-minute easy baseline run', 'Warm up for five minutes, run or run-walk at conversational effort for 20 minutes, then record distance and how hard it felt from 1–10.', 'high', 30),
        task('Choose three weekly run slots', `Put one easy run, one shorter practice run, and one longer run into exact calendar times.${timeNote(context)}`, 'high', 10),
        task('Prepare shoes, route, and recovery water', 'Choose a safe route, place your running kit together, and decide where you will get water afterward.', 'medium', 10),
      ],
      'Easy consistency builds running capacity faster than turning every session into a test. Increase only one of distance, speed, or frequency at a time.',
    );
  }
  const workouts = 24;
  return plan(
    'Build measurable strength in the gym',
    `Complete ${workouts} logged strength workouts—about three per week—and improve at least three core movement patterns with consistent form${deadline(context)}.`,
    workouts,
    'workouts',
    [
      milestone('Four workouts completed and baseline lifts logged', 'Finish four full sessions and record weight, repetitions, and effort for a squat, push, pull, and hip-hinge movement.', 4),
      milestone('Eight workouts completed with a stable routine', 'Use the same core routine for two consecutive weeks and complete every planned working set.', 8),
      milestone('Sixteen workouts completed with three lifts improved', 'Add safe weight or repetitions to at least three core movements while keeping controlled form.', 16),
      milestone('Twenty-four workouts completed and strength retested', 'Repeat the baseline session and show a clear improvement in weight, repetitions, control, or range of motion.', 24),
    ],
    [
      task('Run a four-movement baseline workout', 'After a warm-up, complete 3 controlled sets each of a squat or leg press, chest press, row, and Romanian deadlift. Record the weight and clean repetitions for every set.', 'high', 55),
      task('Save the same workout as your starter routine', 'Put those four movements in one note or workout tracker with 3 sets each. Finish when the routine can be opened at your next session.', 'high', 10),
      task('Book three gym sessions for this week', `Choose exact days and start times with at least one recovery day between hard sessions.${timeNote(context)}`, 'medium', 10),
    ],
    'Strength becomes visible when the same movements are repeated and logged. Add a small amount of weight or one repetition only after every planned repetition is controlled.',
  );
}

function sportPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  const sport = value.match(/football|soccer|basketball|tennis|boxing|swimming|cricket|rugby|golf|skating|skateboard|volleyball/)?.[0];
  if (!sport) return null;
  const labels: Record<string, { test: string; drill: string; performance: string }> = {
    football: { test: '50 controlled touches, 20 wall passes per foot, and 10 shots on target', drill: 'first touch, weak-foot passing, and finishing', performance: 'small-sided match' },
    soccer: { test: '50 controlled touches, 20 wall passes per foot, and 10 shots on target', drill: 'first touch, weak-foot passing, and finishing', performance: 'small-sided match' },
    basketball: { test: '25 layups per side, 30 free throws, and a timed dribble course', drill: 'weak-hand control, finishing, and shooting form', performance: 'pickup game' },
    tennis: { test: '20 forehands, 20 backhands, and 20 serves with results recorded', drill: 'serve placement, rally tolerance, and footwork', performance: 'practice set' },
    boxing: { test: 'three filmed two-minute rounds of stance, straight punches, and defence', drill: 'footwork, clean combinations, and defensive return', performance: 'supervised technical rounds' },
    swimming: { test: 'a comfortable timed distance with stroke count and rest recorded', drill: 'body position, breathing, and efficient pacing', performance: 'continuous timed swim' },
  };
  const detail = labels[sport] ?? { test: 'three core skills tested and recorded under the same conditions', drill: 'technique, decision-making, and execution under pressure', performance: 'real practice game or performance' };
  return plan(
    sentenceCase(title),
    `Complete 20 deliberate ${sport} sessions and improve a repeatable baseline test in technique, control, and performance${deadline(context)}.`,
    20,
    'deliberate sessions',
    [
      milestone('Baseline filmed and scored', `Complete ${detail.test}; record successful attempts, time or accuracy, and one technical weakness.`, 1),
      milestone('Five deliberate sessions completed', `Practise ${detail.drill}; each session must include a recorded target and result.`, 5),
      milestone('Twelve sessions completed with a better retest', 'Repeat the original baseline in the same conditions and show improvement in at least two measures.', 12),
      milestone('Twenty sessions completed and skill transfers to play', `Use the improved skill during a ${detail.performance}, then review footage or feedback against the baseline.`, 20),
    ],
    [
      task(`Record your ${sport} baseline`, `Warm up, then complete ${detail.test}. Record every result honestly and film one attempt from a useful angle.`, 'high', 35),
      task('Choose the single weakest measurable skill', 'Review the baseline and select the weakness costing the most successful attempts. Write its current score and the next score you are targeting.', 'high', 10),
      task('Schedule three deliberate practice sessions', `Book three exact sessions this week. Each must contain 10 minutes of focused technique, 10 minutes of variable practice, and a short scored retest.${timeNote(context)}`, 'medium', 10),
    ],
    'Playing more is not always deliberate practice. Keep the test consistent, isolate one weakness, then prove that the improvement survives real play.',
  );
}

function gamingPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  const game = value.match(/fortnite|valorant|minecraft|rocket league|call of duty|chess/)?.[0] ?? 'your game';
  return plan(
    sentenceCase(title),
    `Complete 20 reviewed practice sessions for ${game}, improving one controllable performance measure at a time${deadline(context)}.`,
    20,
    'reviewed sessions',
    [milestone('Baseline from three matches recorded', 'Record the same three useful measures after three normal matches and identify the most repeated losing decision.', 1), milestone('Five focused sessions completed', 'Warm up one mechanic, play with one decision rule, and review one key moment after every session.', 5), milestone('Twelve sessions completed with a better rolling average', 'Compare the latest five-session average with the baseline using the same mode and measures.', 12), milestone('Twenty sessions completed and performance retested', 'Play a full evaluation set, review the recording, and select the next weakest controllable skill.', 20)],
    [task('Record a three-match baseline', 'Play three normal matches without changing your style. Record outcome plus two controllable measures, then save the timestamp of every major mistake.', 'high', 45), task('Review the three biggest lost moments', 'For each moment, write what you noticed, the choice you made, the stronger choice, and one cue that would help you notice it next time.', 'high', 20), task('Run one focused practice block', 'Warm up the weakest mechanic for 10 minutes, play while following one decision rule, then review whether you followed it—not only whether you won.', 'medium', 35)],
    'Rank and wins are noisy. A reviewed decision or mechanic is controllable, repeatable, and therefore trainable.',
  );
}

function cookingPlan(_value: string, title: string, context?: PlanContext): PlanSpec | null {
  return plan(sentenceCase(title), `Cook 12 complete dishes while deliberately improving knife work, heat control, seasoning, timing, and repeatability${deadline(context)}.`, 12, 'finished dishes', [milestone('Two baseline dishes cooked and reviewed', 'Cook two different dishes, photograph the result, and score taste, texture, timing, and presentation.', 2), milestone('Five dishes completed using core techniques', 'Complete dishes that practise controlled chopping, browning, simmering, and seasoning in stages.', 5), milestone('Nine dishes completed without step-by-step help', 'Cook three familiar dishes from a short ingredient and timing plan rather than continuous instructions.', 9), milestone('Twelve dishes completed including one hosted meal', 'Serve a complete dish on time, collect specific feedback, and write the final repeatable method.', 12)], [task('Cook one baseline dish you actually enjoy', 'Choose a dish with a protein or main component, vegetable, and sauce or seasoning. Time the cook, photograph it, and score taste, texture, timing, and presentation from 1–5.', 'high', 50), task('Write the three biggest corrections', 'For the lowest three scores, name the exact change for next time—for example lower pan heat, salt in stages, or cut pieces to equal size.', 'high', 10), task('Schedule the corrected second attempt', `Choose the recipe, shopping list, date, and serving time now.${timeNote(context)}`, 'medium', 10)], 'Repeating a dish with one deliberate correction builds skill faster than cooking unrelated recipes once.');
}

function speakingPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (/speaking to people|conversation|social|making friends|communicat/.test(value) && !/presentation|public speak|speech/.test(value)) {
    return plan(
      'Speak to people with more confidence',
      `Complete 20 real conversations while deliberately improving openings, follow-up questions, listening, and calm recovery from awkward moments${deadline(context)}.`,
      20,
      'real conversations',
      [milestone('Three short conversations completed', 'Start three low-pressure conversations and record what opener and follow-up kept each one moving.', 3), milestone('Eight conversations completed with stronger follow-ups', 'Ask open questions, listen for one detail, and use it in the next question instead of switching topics.', 8), milestone('Fourteen conversations include longer or unfamiliar interactions', 'Hold several five-minute conversations and initiate with people you do not already know well.', 14), milestone('Twenty conversations completed and reviewed', 'Complete the target, compare confidence and conversation length with the baseline, and keep the best repeatable habits.', 20)],
      [task('Start one 60-second conversation', 'Use a simple observation or genuine question with someone safe. Ask one follow-up about a detail in their answer and finish naturally.', 'high', 10), task('Prepare three natural openers', 'Write one opener for school or work, one for a shared place or activity, and one for reconnecting with someone. Keep each under one sentence.', 'high', 10), task('Review without judging yourself', 'Write what helped the conversation, where it slowed, and one different follow-up to try next time.', 'medium', 5)],
      'Good conversation is not performing perfectly. It is noticing the other person, asking a useful follow-up, sharing a little, and staying present long enough for connection to form.',
    );
  }
  return plan(sentenceCase(title), `Deliver 10 recorded speaking practices and one live presentation with a clear opening, structured message, and confident close${deadline(context)}.`, 10, 'recorded practices', [milestone('First two-minute baseline recorded', 'Deliver once without restarting, then score clarity, pace, filler words, posture, and ending.', 1), milestone('Four practices completed with a stable structure', 'Open with the point, support it with three ideas, and close with one requested action.', 4), milestone('Seven practices completed for a real listener', 'Deliver to at least one person, answer questions, and revise using specific feedback.', 7), milestone('Ten practices and live presentation completed', 'Deliver the full talk under real timing and compare the recording with the baseline.', 10)], [task('Record a two-minute baseline talk', `Speak for two minutes on why ${title} matters without restarting. Watch it once and count filler words, long pauses, and unclear sentences.`, 'high', 15), task('Rewrite it as five speaking beats', 'Write only: hook, main point, three supporting beats, and closing action. Do not write a full script.', 'high', 15), task('Deliver it again with the camera at eye level', 'Use the five beats, finish within two minutes, and compare only clarity, pace, and ending with attempt one.', 'medium', 15)], 'Confidence follows evidence. Short recordings expose one fix at a time and make progress visible before the real audience.');
}

function instrumentPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  const instrument = value.match(/guitar|piano|drum|violin|singing|sing|instrument/)?.[0] ?? 'your instrument';
  return plan(sentenceCase(title), `Complete 24 focused ${instrument} practices and perform three complete pieces at a steady tempo${deadline(context)}.`, 24, 'practice sessions', [milestone('Baseline piece recorded', 'Record one complete attempt without restarting and note every hesitation, timing break, or unclear section.', 1), milestone('Eight focused practices completed', 'Practise the hardest two sections slowly and join them to the easier material.', 8), milestone('Sixteen practices and two pieces performed', 'Play or sing two complete pieces to a metronome or backing track without stopping.', 16), milestone('Twenty-four practices and final performance recorded', 'Perform three pieces from start to finish and compare control, timing, and expression with the baseline.', 24)], [task(`Record one complete ${instrument} baseline`, 'Choose a piece just above your comfort level, perform it once without restarting, and mark the timestamps of every breakdown.', 'high', 20), task('Loop the hardest eight bars five times', 'Practise slowly enough to complete five clean repetitions. Increase tempo only after three consecutive clean attempts.', 'high', 20), task('Book four short practices this week', `Choose exact days and keep each session focused on warm-up, one hard section, and one full attempt.${timeNote(context)}`, 'medium', 10)], 'Full performances reveal the gaps; slow, accurate loops repair them. Keep both in every week.');
}

function habitPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/habit|routine|consistent|consistency|every day|daily|wake up|sleep|quit|stop|reduce|less phone|screen time|meditat/.test(value)) return null;
  const reducing = /quit|stop|reduce|less|avoid/.test(value);
  return plan(sentenceCase(title), `${reducing ? 'Complete 30 days using a replacement response and recording every trigger' : 'Complete the routine on 24 of the next 30 days using a fixed cue and minimum version'}${deadline(context)}.`, 30, 'tracked days', [milestone('First three tracked days completed', 'Record the cue, behaviour, result, and any miss without trying to hide imperfect days.', 3), milestone('Ten days tracked with the environment changed', 'Remove one common source of friction or temptation and keep the minimum version available.', 10), milestone('Twenty days tracked through a difficult week', 'Use the minimum version on busy or low-energy days instead of treating them as automatic misses.', 20), milestone('Thirty days reviewed and next rule chosen', 'Calculate the completion rate, identify the strongest cue and failure pattern, and choose what continues.', 30)], reducing ? [task('Record the next trigger without judging it', 'When the behaviour starts, record time, place, emotion, people present, and what happened immediately before it.', 'high', 5), task('Prepare one two-minute replacement', 'Choose a response that meets the same need with less harm, place what it requires within reach, and write “When [trigger], I will [replacement].”', 'high', 10), task('Add friction before the unwanted behaviour', 'Log out, move the item, block the app, change the route, or add a waiting timer so the old response is no longer automatic.', 'medium', 10)] : [task('Define the two-minute minimum version', `Shrink ${title} to an action that can be completed even on the worst reasonable day. Write exactly what counts and what does not.`, 'high', 10), task('Attach it to one existing cue', 'Use “After I [reliable current action], I will [minimum version] at [place].” Set up the place now.', 'high', 10), task('Track today before going to sleep', 'Create 30 boxes or a repeating tracker. Mark completed, minimum, or missed—never erase a miss.', 'medium', 5)], 'Consistency comes from a reliable cue, an easy minimum, and honest recovery after misses—not from waiting to feel motivated.' );
}

function studyPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (/assignments?|homework|coursework|essays?|reports?|tasks?\s+due/.test(value)) {
    const total = parseLargestNumber(value) ?? 1;
    const suppliedList = clarificationAnswers(context?.additionalDetails)[0];
    const firstBatch = Math.max(1, Math.ceil(total * 0.2));
    return plan(
      `Complete ${total} ${total === 1 ? 'assignment' : 'assignments'}`,
      `Complete and submit all ${total} ${total === 1 ? 'assignment' : 'assignments'}, ordered by due date, grade impact, effort, and dependency.${suppliedList ? ` Planning details: ${suppliedList}.` : ''}`,
      total,
      'assignments completed',
      [
        milestone('Every assignment is scoped and prioritised', 'Each item has its due date, weighting, estimated effort, submission method, and smallest next action recorded.', Math.min(1, total)),
        milestone(`${firstBatch} ${firstBatch === 1 ? 'assignment' : 'assignments'} submitted`, 'The most urgent high-impact work is submitted—not merely started or drafted.', firstBatch),
        milestone(`${Math.max(firstBatch + 1, Math.ceil(total * 0.67))} assignments submitted`, 'The remaining workload fits into the available time with contingency before each deadline.', Math.max(firstBatch + 1, Math.ceil(total * 0.67))),
        milestone(`All ${total} assignments submitted`, 'Every submission is confirmed and the files or receipts are stored in one place.', total),
      ],
      [
        task('Build the assignment priority board', 'List every assignment with subject, exact due time, grade weighting, estimated hours, current stage, and submission link. Sort by urgency × impact—not by which feels easiest.', 'high', 20),
        task('Complete the next shippable section', 'Open the highest-priority assignment, identify the next section that can become complete, and work on only that section for one focused block.', 'high', 30),
        task('Time-block every remaining assignment', `Work backward from each deadline, add a buffer before submission, and reserve exact drafting, editing, and upload blocks.${timeNote(context)}`, 'high', 20),
      ],
      'When several assignments compete, “work harder” is not a plan. Protect the earliest high-impact deadline, finish in submission-sized sections, and keep a buffer for upload or formatting problems.',
    );
  }
  if (!/study|exam|grade|school|college|university|course|revise|revision|gcse|a.?level|test/.test(value)) return null;
  const papers = 8;
  return plan(
    sentenceCase(title),
    `Complete ${papers} marked practice papers or equivalent timed topic sets, using every mistake to direct the next revision block${deadline(context)}.`,
    papers,
    'marked practices',
    [
      milestone('First timed practice marked', 'Complete one timed paper or topic set, calculate the score, and label every error by topic.', 1),
      milestone('Three practices completed and weakest topics retested', 'Relearn the two weakest topics and show a higher score when they are tested again.', 3),
      milestone('Six practices completed at target pace', 'Finish six marked practices within the real time limit and reduce repeated mistakes.', 6),
      milestone('Eight practices completed with a stable target score', 'Reach the desired score band on two consecutive timed attempts.', 8),
    ],
    [
      task('Complete one timed diagnostic set', 'Choose a past-paper section that covers several topics, work without notes for 25 minutes, then stop exactly when the timer ends.', 'high', 25),
      task('Mark it and build an error list', 'For every lost mark, write the topic, why the answer failed, and the correct method in one sentence.', 'high', 20),
      task('Redo the three weakest questions unaided', 'Close the mark scheme, solve the three highest-value mistakes again, and check that each answer now earns full marks.', 'medium', 20),
    ],
    'Revision should respond to evidence. The marked practice tells you what to study; the immediate retry proves whether the gap was actually fixed.',
  );
}

function languagePlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/spanish|french|german|italian|japanese|korean|mandarin|arabic|language|vocabulary|fluent|speaking/.test(value)) return null;
  const conversations = 12;
  return plan(
    sentenceCase(title),
    `Complete ${conversations} real speaking sessions and build a reusable bank of phrases for situations you care about${deadline(context)}.`,
    conversations,
    'conversations',
    [
      milestone('First two conversations completed', 'Hold two 10-minute sessions using prepared phrases and note every idea you could not express.', 2),
      milestone('Five conversations completed without reading a script', 'Speak about familiar topics with prompts only, then correct the most common errors.', 5),
      milestone('Eight conversations include spontaneous questions', 'Ask and answer follow-up questions without switching language for the whole session.', 8),
      milestone('Twelve conversations completed', 'Complete a 20-minute conversation and compare fluency with the first recording.', 12),
    ],
    [
      task('Write and record a 60-second self-introduction', 'Include your name, work or study, interests, and one current goal. Listen back and correct pronunciation using one trusted reference.', 'high', 20),
      task('Learn 10 phrases you will genuinely use', 'Create cards for 10 complete phrases—not isolated words—and say each aloud in a new sentence.', 'high', 20),
      task('Book the first 10-minute conversation', `Choose a tutor, language partner, or voice exchange and put the exact session time in your calendar.${timeNote(context)}`, 'medium', 10),
    ],
    'Speaking exposes the gaps that passive study hides. Save phrases from real conversations, then deliberately reuse them in the next one.',
  );
}

function softwarePlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  const buildingProduct = /\b(build|create|develop|launch|make|design)\b.*\b(app|website|software|saas|game|bot|tool)\b/.test(value);
  const codingSkill = /python|javascript|typescript|coding|programming|scripting|developer|code/.test(value);
  if (!buildingProduct && !codingSkill) return null;
  if (!buildingProduct) return plan(
    sentenceCase(title),
    `Complete three progressively harder working projects that demonstrate practical ${title} ability. Progress is counted by projects that run and can be explained.`,
    3,
    'projects',
    [
      milestone('First useful project works end-to-end', 'Finish a small project that accepts input, produces a useful result, and handles one common error.', 1),
      milestone('Second project uses files or an external API', 'Finish a project that reads persistent data or integrates one documented service.', 2),
      milestone('Third project completed independently', 'Scope, build, test, and document a useful project with minimal step-by-step guidance.', 3),
    ],
    /python|script/i.test(value) ? [
      task('Build a script that renames five test files', 'Create a test folder, use pathlib to rename five files from a consistent rule, run the script, and verify all five names changed correctly.', 'high', 35),
      task('Add one safe failure path', 'Run the script against a missing folder. Catch the failure and print a clear message instead of showing a traceback.', 'high', 20),
      task('Rebuild the file loop without copying', 'Close the reference, recreate the loop from memory, run it on a fresh test folder, then compare and correct only what failed.', 'medium', 25),
    ] : [
      task('Build one input-to-output programme', 'Create a small programme that accepts real user input, transforms it, and prints or displays a useful result.', 'high', 40),
      task('Add validation for one bad input', 'Choose the most likely invalid input and make the programme recover with a useful message.', 'high', 20),
      task('Explain the programme in five sentences', 'Write what enters, what each main part does, what exits, and one improvement you would make next.', 'medium', 15),
    ],
    'Tutorials feel productive, but finished projects reveal what you can actually do. Each project should remove some scaffolding from the previous one.',
  );
  return plan(
    sentenceCase(title),
    `Ship four working releases: a clickable prototype, the core end-to-end flow, a tested beta, and a usable public release${deadline(context)}.`,
    4,
    'releases',
    [
      milestone('Clickable prototype tested with one person', 'The shortest user journey can be clicked from start to finish and one target user has reacted to it.', 1),
      milestone('Core flow works with real data', 'A user can complete the product’s main job and see the result persist after reopening.', 2),
      milestone('Private beta survives five real attempts', 'Five end-to-end attempts complete successfully and the most serious failure has been fixed.', 3),
      milestone('Public release is live', 'The product has a stable URL or downloadable build, onboarding, and a way to report problems.', 4),
    ],
    [
      task('Write the one-sentence user promise', `Use this format: “For [specific user], ${title} helps them [result] without [current pain].” Finish when every bracket contains one concrete answer.`, 'high', 10),
      task('Sketch only the core user journey', 'Draw the minimum screens from opening the product to receiving its main value. Exclude settings, profiles, and polish unless required by the flow.', 'high', 20),
      task('Build the smallest input-to-result path', 'Create one working path using temporary data if necessary. Finish when you can demonstrate the main action without explaining missing steps.', 'high', 60),
    ],
    'A working narrow flow teaches more than a wide collection of unfinished screens. Prove the core value before adding features.',
  );
}

function careerPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/job|career|promotion|interview|cv|résumé|resume|client|business|revenue|freelance/.test(value)) return null;
  const target = parseLargestNumber(value) ?? (/client|business|freelance/.test(value) ? 10 : 20);
  const clientMode = /client|business|freelance|revenue/.test(value);
  const unit = clientMode ? 'qualified outreaches' : 'quality applications';
  return plan(
    sentenceCase(title),
    `Complete ${target} ${unit} with tailored evidence and track every response${deadline(context)}.`,
    target,
    unit,
    ratioMilestones(target, [0.1, 0.3, 0.6, 1], (amount) => `${Math.round(amount)} ${unit} completed`, [
      'The first messages are sent and the tracking sheet includes role/client, date, and next follow-up.',
      'Use response patterns to rewrite the weakest evidence or opening message.',
      'Follow up every viable lead and practise answers to the questions appearing most often.',
      'Complete the full outreach target and review response, interview, and conversion rates.',
    ]),
    clientMode ? [
      task('Write one outcome-based offer', 'Name one specific customer, painful problem, deliverable, timeframe, and price range in five lines or fewer.', 'high', 20),
      task('Find five people who match the offer', 'Save five real prospects with a visible reason they need the result. Exclude generic lists with no evidence of fit.', 'high', 25),
      task('Send the first personalised message', 'Reference one true detail about the prospect, state the result you can help with, and ask one low-friction question.', 'high', 15),
    ] : [
      task('Save one role you would genuinely accept', 'Check location, pay range, responsibilities, and required experience. Finish only when the role passes all four checks.', 'high', 15),
      task('Match three pieces of evidence to the role', 'For three important requirements, write one example with the action you took and a measurable result.', 'high', 20),
      task('Submit the tailored application', 'Update the top third of your CV and opening paragraph for this role, proofread once, then submit and record the date.', 'high', 30),
    ],
    'Measure controllable, high-quality attempts first. Responses then become evidence for improving positioning instead of a judgement on your ability.',
  );
}

function readingPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/read|book|novel/.test(value)) return null;
  if (/\d[\d,]*\s*pages?/.test(value)) {
    const pages = parseLargestNumber(value) ?? 300;
    const daily = Math.max(1, Math.ceil(pages / (/this month/.test(value) ? 30 : 21)));
    return plan(
      `Read ${pages.toLocaleString('en-GB')} pages`,
      `Read and record ${pages.toLocaleString('en-GB')} pages${/this month/.test(value) ? ' this month' : deadline(context)}. Progress is the last page completed, with a short note after each reading block.`,
      pages,
      'pages',
      ratioMilestones(pages, [0.1, 0.35, 0.7, 1], (amount) => `${Math.round(amount)} pages completed`, ['The reading setup and daily pace are working.', 'The first third is complete and missed days have been recovered deliberately.', 'Most of the target is complete with the pace still sustainable.', 'The full page target is complete and the most useful ideas are captured.']),
      [
        task(`Read the first ${Math.min(daily, 20)} pages`, 'Choose the exact book or material, silence notifications, read the pages, then record the finishing page.', 'high', 25),
        task(`Schedule a ${daily}-page daily block`, 'Pick one reliable trigger and exact time for the next seven days. Put the book where the session will start.', 'high', 10),
        task('Capture one useful sentence', 'Write one idea, question, or application from today’s pages in your own words.', 'medium', 5),
      ],
      `A pace of about ${daily} pages per day reaches the target without vague “read more” tasks. If you miss a day, spread the pages across the next three sessions instead of doubling one session.`,
    );
  }
  const books = /\d+\s*books?/.test(value) ? parseLargestNumber(value)! : 6;
  return plan(sentenceCase(title), `Finish ${books} books and capture one useful takeaway from each${deadline(context)}.`, books, 'books', ratioMilestones(books, books < 4 ? [1 / books, 1] : [1 / books, 0.34, 0.67, 1], (amount) => `${Math.max(1, Math.round(amount))} book${Math.round(amount) === 1 ? '' : 's'} finished`, ['The first book is complete and one takeaway is saved.', 'A recurring reading block has survived busy days.', 'Reading pace is stable and abandoned books have been deliberately replaced.', 'The full target is complete and the best ideas are collected.']), [task('Choose the first book and finish 20 pages', 'Pick the book now, silence notifications, read 20 pages, and mark the exact page where the next session begins.', 'high', 30), task('Book four reading sessions', `Add four exact 25-minute slots across the next seven days.${timeNote(context)}`, 'medium', 10), task('Write one sentence worth remembering', 'After reading, write one idea, quote location, or question in your own words.', 'medium', 5)], 'A book only counts when it is finished or deliberately abandoned for a stated reason. The short takeaway turns reading into usable memory.');
}

function homePlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/clean|declutter|organize|organise|room|house|home|renovate|tidy/.test(value)) return null;
  const areas = 8;
  return plan(sentenceCase(title), `Finish ${areas} clearly defined areas, each photographed or checked after everything has a permanent home${deadline(context)}.`, areas, 'areas', [milestone('First area completely reset', 'One small, visible area is empty of rubbish, cleaned, and contains only items that belong there.', 1), milestone('Three high-friction areas finished', 'Complete the three places that most often create daily mess or wasted time.', 3), milestone('Six areas finished with maintenance rules', 'Each finished area has a simple rule for what belongs there and when it is reset.', 6), milestone('Eight areas finished and maintained for one week', 'All target areas remain usable after seven normal days.', 8)], [task('Finish one visible surface completely', 'Choose one desk, worktop, table, or shelf. Remove everything, clean it, then return only items that belong there.', 'high', 20), task('Create keep, relocate, donate, and bin zones', 'Place four labelled bags or boxes beside the next area so every object has an immediate decision.', 'medium', 10), task('Remove one full bag from the room', 'Take rubbish to the bin or donations to the exit point today—do not leave the bag as a new pile.', 'high', 10)], 'Completing one boundary creates visible relief. Do not spread objects across several half-finished rooms; close one area before opening the next.');
}

function creativePlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/write|draw|paint|music|song|video|film|content|podcast|design|novel|art/.test(value)) return null;
  return plan(sentenceCase(title), `Produce four reviewable versions: concept, rough draft, revised draft, and finished piece${deadline(context)}.`, 4, 'versions', [milestone('Concept and audience are fixed', 'The piece has one intended audience, purpose, format, and finish condition.', 1), milestone('Complete rough version exists', 'Every major section exists in imperfect form; no blank structural gaps remain.', 2), milestone('Revision solves the three largest problems', 'Feedback identifies the biggest issues and a revised version addresses each one.', 3), milestone('Finished piece is shared or published', 'The final file is exported, named, backed up, and delivered to its audience.', 4)], [task('Write the finished-piece brief', 'In five lines, state the audience, intended reaction, format, length, and exact condition that means the piece is finished.', 'high', 10), task('Create the complete rough structure', 'Outline every section, scene, frame, or component from beginning to end without polishing details.', 'high', 25), task('Produce the first ugly section', 'Finish one representative section quickly enough that someone else could react to it. Do not edit while creating.', 'high', 30)], 'A complete rough version is more valuable than a polished fragment because it exposes structural problems while they are still cheap to fix.');
}

function travelPlan(value: string, title: string, context?: PlanContext): PlanSpec | null {
  if (!/travel|trip|holiday|vacation|visit|flight/.test(value)) return null;
  return plan(sentenceCase(title), `Complete six travel commitments: dates, budget, transport, accommodation, essential documents, and a usable itinerary${deadline(context)}.`, 6, 'preparations', [milestone('Dates and maximum budget agreed', 'The travel window and hard spending ceiling are written down.', 1), milestone('Transport and accommodation selected', 'Comparable options are checked for total cost, cancellation terms, and location.', 3), milestone('Documents and essential bookings confirmed', 'Passport or ID validity, insurance needs, and time-sensitive bookings are checked.', 5), milestone('Trip is ready to take', 'All six preparations are complete and confirmation details are accessible offline.', 6)], [task('Set the date window and hard budget', 'Write earliest departure, latest return, and the maximum total you can spend including transport, stay, food, and a 10% buffer.', 'high', 15), task('Compare three complete travel combinations', 'For each option, record transport plus accommodation total, travel time, location, and cancellation conditions.', 'high', 30), task('Choose the next commitment and deadline', 'Decide whether transport, accommodation, documents, or saving must happen first and set the exact date it will be completed.', 'medium', 10)], 'Compare whole-trip cost rather than attractive headline prices. A cheaper flight can become the expensive option after baggage, transfers, and poor accommodation location.');
}

function generalPlan(title: string, context?: PlanContext): PlanSpec {
  const details = clarificationAnswers(context?.additionalDetails);
  const definition = details[0] ?? `a visible result that proves ${title}`;
  const startingPoint = details[1] ?? 'the current starting point';
  const time = details[2] || context?.availableTime?.trim() || 'one focused block each week';
  return plan(
    sentenceCase(title),
    `Success means ${definition}. The plan starts from ${startingPoint}, using ${time}${deadline(context)}.`,
    4,
    'proof points',
    [
      milestone('Success test and baseline recorded', `Turn “${definition}” into a yes/no test or a number, then record the honest result from ${startingPoint}.`, 1),
      milestone('First complete attempt tested', 'Complete the smallest end-to-end attempt and compare its result with the success test.', 2),
      milestone('Weakest failure corrected and retested', 'Change the one factor causing the largest gap, then repeat the same test under the same conditions.', 3),
      milestone('Target result achieved twice', 'Meet the success test twice so the outcome is repeatable rather than a one-off.', 4),
    ],
    [
      task('Turn success into one pass-or-fail test', `Use this answer: “${definition}.” Write the exact number, observable result, or person who will judge it—and what counts as passing.`, 'high', 10),
      task('Run and record the honest baseline', `Starting from ${startingPoint}, attempt the real activity once without extra preparation. Save the score, recording, outcome, or checklist result.`, 'high', 25),
      task('Schedule the first improvement-and-retest block', `Reserve time from your stated capacity—${time}. Spend the first two-thirds fixing the earliest failure, then repeat the same baseline test.`, 'medium', 10),
    ],
    'The plan uses your own success test instead of invented percentages. Keep the test stable until the evidence shows exactly what needs to change.',
  );
}

function buildShapePlan(parsed: ParsedGoal, title: string, context?: PlanContext): PlanSpec {
  const subject = parsed.subject || title;
  const template = INTENT_TEMPLATES[parsed.intent];
  if (parsed.shape === 'quantity' && parsed.targetValue && parsed.targetUnit) {
    const target = parsed.targetValue;
    const unit = parsed.targetUnit;
    const first = Math.max(1, Math.ceil(target * 0.05));
    return plan(
      sentenceCase(title),
      `Complete ${pretty(target)} ${unit} with progress recorded in the same unit${deadline(context)}.`,
      target,
      unit,
      ratioMilestones(target, [0.1, 0.35, 0.7, 1], (amount) => `${pretty(amount)} ${unit} completed`, ['The first repeatable batch is complete.', 'The pace is working under normal conditions.', 'Most of the target is complete and the remaining work is scheduled.', 'The full target is complete and checked.']),
      [
        task(`Complete the first ${pretty(first)} ${unit}`, `Do a real first batch of ${subject}, record the exact result, and note how long it took.`, 'high', 25),
        task('Calculate the repeatable batch size', 'Use the first batch time and deadline to choose a daily or weekly amount that fits your real capacity.', 'high', 10),
        task('Schedule the next three batches', `Reserve exact start times and define what count must be reached in each block.${timeNote(context)}`, 'medium', 10),
      ],
      'Quantity goals become useful when the unit, pace, and next batch are explicit. Adjust the schedule from real completion speed—not optimism.',
    );
  }
  if (parsed.shape === 'project' || parsed.intent === 'build' || parsed.intent === 'finish') {
    const finishing = parsed.intent === 'finish';
    return plan(
      sentenceCase(title),
      `${finishing ? 'Finish' : 'Build'} ${subject} through four reviewable stages: scope, working version, quality pass, and delivery${deadline(context)}.`,
      4,
      'deliverables',
      [
        milestone('Scope and finish condition locked', 'The intended user or audience, required result, non-negotiable requirements, and excluded work are written down.', 1),
        milestone('Smallest complete version works', 'The core outcome works from beginning to end without relying on unfinished sections.', 2),
        milestone('Quality pass fixes the largest risks', 'The result is tested or reviewed and the highest-impact failures are corrected.', 3),
        milestone('Final result delivered', 'The finished version is submitted, published, handed over, or otherwise reaches its intended destination.', 4),
      ],
      [
        task(finishing ? 'List the exact remaining work' : 'Define the smallest complete version', `Write the required outcome for ${subject}, then separate must-have work from optional polish.`, 'high', 15),
        task('Finish one end-to-end slice', 'Choose the smallest part that moves from input to finished result. Complete it fully before opening another branch of work.', 'high', 35),
        task('Set the review and delivery checks', 'Write who or what will test it, the three most likely failure points, and the exact delivery step.', 'medium', 15),
      ],
      'A complete narrow version exposes the truth sooner than several polished fragments. Control scope first, then improve what real testing proves matters.',
    );
  }
  if (parsed.shape === 'habit') {
    return habitPlan(parsed.normalizedText, title, context) ?? generalPlan(title, context);
  }
  if (parsed.shape === 'wellbeing') {
    return plan(
      sentenceCase(title),
      `Improve ${subject} over 30 tracked days using a safe baseline, one sustainable routine, and weekly review${deadline(context)}.`,
      30,
      'tracked days',
      [milestone('Seven-day baseline recorded', 'Track the relevant behaviour and result consistently without trying to perfect it yet.', 7), milestone('Fourteen days completed with one stable routine', 'Use one small change long enough to judge its effect rather than changing several things at once.', 14), milestone('Twenty-one days completed through a normal difficult week', 'Keep the minimum version working when time, mood, or energy is worse than usual.', 21), milestone('Thirty days reviewed and next step chosen', 'Compare the final week with the baseline and decide what to keep, change, or discuss with a professional.', 30)],
      [task(`Record today’s ${subject} baseline`, 'Choose one useful measure—duration, frequency, intensity, or a simple 1–10 rating—and record it under normal conditions.', 'high', 10), task('Choose one low-risk improvement', 'Pick one small environment or routine change that is realistic to repeat for seven days. Avoid stacking several changes.', 'high', 10), task('Set the seven-day review', 'Choose the exact date and measures you will compare. If symptoms are severe, worsening, or unsafe, involve a qualified professional.', 'medium', 5)],
      'Health-related progress is noisy. Change one controllable factor, track the trend, and seek qualified help when the goal involves symptoms, medication, injury, or significant distress.',
    );
  }
  if (parsed.shape === 'performance') {
    return plan(sentenceCase(title), `${template.outcomeFrame.replace('{subject}', subject)}${deadline(context)}`, 12, 'realistic practices', template.milestoneFrames.map((frame, index) => milestone(frame.replace('{subject}', subject), 'Complete this stage under conditions close to the real event and record the result.', [1, 4, 8, 12][index] ?? 12)), [task(`Run a ${subject} diagnostic`, 'Attempt a short version under realistic conditions and record the exact gaps that affect the result.', 'high', 25), task('Choose the highest-impact gap', 'Pick the weakness most likely to change the outcome and define one drill with a score or pass condition.', 'high', 10), task('Schedule practice and a full rehearsal', `Book two focused practices and one realistic retest.${timeNote(context)}`, 'medium', 10)], 'Preparation improves fastest when practice resembles the real event and every session responds to observed evidence.');
  }
  if (parsed.shape === 'skill' || parsed.intent === 'learn' || parsed.intent === 'improve') {
    return plan(sentenceCase(title), `${template.outcomeFrame.replace('{subject}', subject)}${deadline(context)}`, 12, 'deliberate sessions', [milestone('Baseline skill demonstrated', `Complete a real ${subject} attempt and record what currently works and fails.`, 1), milestone('Four focused sessions completed', 'Practise the highest-impact subskill with a consistent result measure.', 4), milestone('Eight sessions completed with a harder retest', 'Repeat the baseline under slightly harder or more independent conditions.', 8), milestone('Twelve sessions completed and skill demonstrated', 'Produce or perform a complete result without step-by-step help.', 12)], [task(`Complete one real ${subject} attempt`, 'Do a small authentic version without extra preparation. Save the result and identify the earliest point where you become stuck.', 'high', 25), task('Turn the first gap into one drill', 'Choose one repeatable exercise that isolates the gap and define the number, quality check, or example that counts as improvement.', 'high', 15), task('Schedule three learn–practise–apply sessions', `Each session should learn one idea, practise it briefly, then use it in a real result.${timeNote(context)}`, 'medium', 10)], 'Skill goals need transfer, not just consumption. Every learning block should end with something performed, solved, built, or explained.');
  }
  return generalPlan(title, context);
}

function isReusableQuantityUnit(unit?: string) {
  if (!unit) return false;
  return !['£', '$', '€', 'kg', 'lb', 'km', 'mile', 'pages', 'books'].includes(unit);
}

function plan(title: string, description: string, targetValue: number, unit: string, milestones: GeneratedMilestone[], todayTasks: GeneratedTask[], insight: string): PlanSpec {
  const roundedTarget = positive(targetValue);
  const fixedMilestones = milestones.map((item, index) => ({ ...item, targetValue: index === milestones.length - 1 ? roundedTarget : Math.min(roundedTarget, positive(item.targetValue)) }));
  return { goal: { title, description: `${description}${contextNote()}`, targetValue: roundedTarget, unit }, milestones: fixedMilestones, todayTasks, insight };
}

function ratioMilestones(target: number, ratios: number[], title: (amount: number, index: number) => string, descriptions: string[]) {
  const values: number[] = [];
  return ratios.map((ratio, index) => {
    const amount = index === ratios.length - 1 ? target : Math.max(index + 1, Math.round(target * ratio));
    const increasing = Math.max((values[index - 1] ?? 0) + 1, Math.min(target, amount));
    values.push(increasing);
    return milestone(title(increasing, index), descriptions[index] ?? 'Complete and record this result.', increasing);
  });
}

function milestone(title: string, description: string, targetValue: number): GeneratedMilestone { return { title, description, targetValue: positive(targetValue) }; }
function task(title: string, description: string, priority: GeneratedTask['priority'], estimatedMinutes: number): GeneratedTask { return { title, description, priority, estimatedMinutes }; }
function positive(value: number) { return Math.max(1, Math.round(value * 100) / 100); }
function pretty(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ''); }
function sentenceCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function cleanGoalTitle(value: string) { return value.replace(/^(?:i\s+want\s+to|i'd\s+like\s+to|my\s+goal\s+is\s+to|i\s+need\s+to)\s+/i, '').replace(/[.!?]+$/, '').trim(); }
function parseLargestNumber(value: string) { const values = [...value.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\b/g)].map((match) => Number(match[1]!.replace(/,/g, ''))).filter((number) => Number.isFinite(number) && number > 0); return values.length ? Math.max(...values) : null; }
function detectCurrency(value: string) { if (/\$|dollars?|usd/.test(value)) return '$'; if (/€|euros?|eur/.test(value)) return '€'; return '£'; }
function formatValue(value: number, unit: string) { const amount = Math.round(value); return `${unit}${amount.toLocaleString('en-GB')}`; }
function deadline(context?: PlanContext) { return context?.targetDate?.trim() ? ` by ${context.targetDate.trim()}` : ''; }
function timeNote(context?: PlanContext) { return context?.availableTime?.trim() ? ` You said you have ${context.availableTime.trim()}.` : ''; }
function contextNote() {
  const context = activePlanContext;
  const parts: string[] = [];
  if (context?.currentProgress?.trim()) parts.push(`Starting point: ${context.currentProgress.trim()}.`);
  if (context?.constraints?.trim()) parts.push(`Constraints: ${context.constraints.trim()}.`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}
function weeklyAmount(target: number, targetDate?: string) { const date = targetDate ? new Date(`${targetDate}T12:00:00`) : null; const weeks = date && !Number.isNaN(date.getTime()) ? Math.max(1, Math.ceil((date.getTime() - Date.now()) / 604_800_000)) : 20; return Math.max(1, Math.ceil(target / weeks)); }
function clarificationAnswers(value?: string) { return (value ?? '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.endsWith('?')); }
