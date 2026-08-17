// @ts-nocheck -- This file runs in Supabase's Deno Edge runtime, not Expo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const planSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['plan', 'clarification'] },
    clarificationMessage: { type: 'string' },
    questions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    goal: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        targetValue: { type: 'number' },
        unit: { type: 'string' },
      },
      required: ['title', 'description', 'targetValue', 'unit'],
    },
    milestones: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          targetValue: { type: 'number' },
        },
        required: ['title', 'description', 'targetValue'],
      },
    },
    todayTasks: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          estimatedMinutes: { type: 'number' },
        },
        required: ['title', 'description', 'priority', 'estimatedMinutes'],
      },
    },
    insight: { type: 'string' },
  },
  required: ['kind', 'clarificationMessage', 'questions', 'goal', 'milestones', 'todayTasks', 'insight'],
};

const systemPrompt = `You are DOIT's expert goal architect. Turn a person's natural-language ambition into a practical, domain-specific execution system.

DECISION
- Infer reasonable details when the intent is understandable. A broad goal such as "get better at Python scripting" is understandable: convert it into a concrete proof-of-skill outcome. Do not ask a question just because no deadline was supplied.
- Return kind="clarification" only when the request has no clear outcome/domain, conflicts with itself, or one missing choice would radically change the plan. Ask 1-3 short factual questions. For clarification, use an empty title/description/insight, targetValue 1, unit "steps", and empty milestone/task arrays.
- Otherwise return kind="plan", an empty clarificationMessage, and an empty questions array.
- clarificationAnswers contains the user's answer text and clarificationTranscript preserves each previous question with its answer. Treat them as authoritative context and merge them with requestedGoal.
- clarificationResolved=true means the user has already completed DOIT's single clarification round. You MUST return kind="plan". Infer any remaining non-critical detail; never return another clarification.

GOAL QUALITY
- Interpret the actual intent; do not merely paste the user's sentence into templates.
- Rewrite the goal as a concise observable outcome. Preserve important amounts, dates, subjects, and constraints.
- Choose a natural progress unit people can log: pounds saved, kilometres, workouts, pages, applications, scripts, clients, lessons, practice tests, etc.
- Never use "%" or generic "steps/checkpoints" when a real-world unit or proof of completion can be inferred.
- targetValue must be positive and match the unit. If the request is an open-ended skill, define a credible proof-of-skill target (for example, several progressively harder completed projects), not fake percentage completion.
- The description must state what success looks like and how progress is counted, in plain language.

MILESTONES
- Create 3-5 evidence-based milestones specific to this exact goal and domain.
- targetValue values must be strictly increasing, use the goal's unit, and the last must equal goal.targetValue.
- Titles must describe real evidence or results. Never output "20% complete", "50% complete", "goal achieved", "first repeatable result", or similarly generic language.

FIRST ACTIONS
- Create 2-4 actions the user can genuinely start today. Each must contain a concrete verb, object, and clear done condition.
- Prefer doing over meta-planning. Do not use "define the outcome", "choose checkpoints", "make a plan", "remove a blocker", or "complete a first pass" unless that activity itself is the user's requested outcome.
- Use the supplied time and constraints. Keep each action between 5 and 90 minutes and sequence prerequisites first.
- Make descriptions useful enough that a person knows exactly what to do without asking what the task means.

Use British English where natural. Do not claim certainty about medical, legal, or financial outcomes; for high-stakes goals, frame actions as organisation/preparation and recommend qualified help where appropriate.`;

function cleanString(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function uniqueQuestions(values: unknown[]) {
  const accepted: { question: string; words: Set<string> }[] = [];
  const ignored = new Set(['a','an','and','are','can','do','does','for','give','how','is','it','look','like','me','one','or','right','the','this','to','what','which','you','your']);
  for (const value of values) {
    const question = cleanString(value, 180);
    if (!question) continue;
    const words = new Set(question.toLowerCase().replace(/[^a-z0-9£]+/g, ' ').split(' ').filter((word) => word.length > 1 && !ignored.has(word)));
    const repeats = accepted.some((item) => {
      let shared = 0;
      words.forEach((word) => { if (item.words.has(word)) shared += 1; });
      return shared / Math.max(1, Math.min(words.size, item.words.size)) >= 0.62;
    });
    if (!repeats) accepted.push({ question, words });
  }
  return accepted.map((item) => item.question).slice(0, 3);
}

const goalActionWords = new Set(['achieve','apply','be','become','build','buy','clear','complete','cook','create','cut','deliver','develop','draw','earn','exercise','finish','fix','gain','get','grow','have','improve','increase','launch','learn','lose','lower','make','master','move','need','organise','organize','pass','pay','play','practice','practise','prepare','quit','read','reduce','run','save','sell','speak','start','stop','study','submit','train','travel','visit','walk','want','write']);

function goalPromptIssue(value: string) {
  const prompt = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (prompt.length < 5) return 'Describe what you want to achieve in a short sentence.';
  if (/(.)\1{4,}/iu.test(prompt) || /(?:asdf|qwer|zxcv|hjkl|1234|abcd|wxyz)/i.test(prompt.replace(/\s/g, ''))) return 'That looks like random text. Tell DOIT the outcome you actually want.';
  const letterWords = prompt.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  const hasNumberOrAmount = /\d|[£$€¥]/u.test(prompt);
  const normalisedWords = letterWords.map((word) => word.toLocaleLowerCase('en-GB'));
  const hasAction = normalisedWords.some((word) => goalActionWords.has(word));
  if ((letterWords.length < 2 && !(letterWords.length === 1 && hasAction && hasNumberOrAmount)) || letterWords.every((word) => word.length <= 1)) return 'Use at least two meaningful words, like “learn Spanish” or “save £500”.';
  const latinWords = normalisedWords.filter((word) => /^[a-z]+$/i.test(word));
  const consonantMashCount = latinWords.filter((word) => word.length >= 4 && !/[aeiouy]/i.test(word)).length;
  if (latinWords.length > 0 && consonantMashCount >= Math.ceil(latinWords.length * 0.6)) return 'That looks like random letters. Write the goal as something you want to do or finish.';
  if (letterWords.length === 2 && !hasAction && !hasNumberOrAmount) return 'Turn that into an outcome, for example “improve my fitness” or “finish my project”.';
  if (letterWords.length <= 3 && letterWords.every((word) => word.length <= 3) && !hasAction && !hasNumberOrAmount) return 'Add a real action and outcome so DOIT knows what you mean.';
  return '';
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text;
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
      if (content?.type === 'refusal') throw new Error('The AI planner could not help with that request.');
    }
  }
  throw new Error('The AI planner returned no usable output.');
}

function qualityIssue(plan: any) {
  if (!plan?.goal || !Array.isArray(plan.milestones) || !Array.isArray(plan.todayTasks)) return 'missing plan fields';
  if (plan.milestones.length < 3 || plan.todayTasks.length < 2) return 'too few milestones or actions';
  if (!Number.isFinite(plan.goal.targetValue) || plan.goal.targetValue <= 0) return 'invalid target';
  const values = plan.milestones.map((item: any) => Number(item.targetValue));
  if (values.some((value: number) => !Number.isFinite(value) || value <= 0)) return 'invalid milestone target';
  if (values.some((value: number, index: number) => index > 0 && value <= values[index - 1])) return 'milestones are not increasing';
  if (Math.abs(values.at(-1) - Number(plan.goal.targetValue)) > 0.0001) return 'last milestone does not equal the goal target';
  const generic = /\b(?:\d{1,3}% complete|goal achieved|first repeatable result|visible progress|finish is within reach|define (?:the|your) outcome|choose (?:three )?checkpoints|remove (?:a|one) blocker|complete (?:a|the) first pass)\b/i;
  if ([...plan.milestones, ...plan.todayTasks].some((item: any) => generic.test(`${item.title} ${item.description}`))) return 'generic template language';
  if (plan.goal.unit === '%' && !/%|percent/i.test(plan.goal.description)) return 'an artificial percentage unit';
  return '';
}

async function recordUsage(supabaseUrl: string, serviceRoleKey: string | undefined, userId: string, success: boolean, inputTokens: number, outputTokens: number) {
  if (!serviceRoleKey) return;
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    await admin.rpc('complete_ai_goal_plan_generation', {
      p_user_id: userId,
      p_success: success,
      p_input_tokens: Math.max(0, Math.round(inputTokens)),
      p_output_tokens: Math.max(0, Math.round(outputTokens)),
    });
  } catch (error) {
    console.error('Could not record AI usage:', error instanceof Error ? error.message : 'unknown');
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let usageUserId = '';
  let usageSupabaseUrl = '';
  let usageServiceRoleKey: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let quotaReserved = false;
  let usageRecorded = false;
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in to build an AI plan.' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !anonKey) return json({ error: 'Supabase authentication is not configured.' }, 503);
    if (!openAIKey) return json({ error: 'The AI planner is not configured yet.' }, 503);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: 'Your session expired. Please sign in again.' }, 401);

    usageUserId = user.id;
    usageSupabaseUrl = supabaseUrl;
    usageServiceRoleKey = serviceRoleKey;

    const body = await request.json().catch(() => ({}));
    const prompt = cleanString(body?.prompt, 1200);
    const promptIssue = goalPromptIssue(prompt);
    if (promptIssue) return json({ error: promptIssue, code: 'invalid_goal_prompt' }, 400);
    const context = body?.context && typeof body.context === 'object' ? body.context : {};
    const userInput = {
      requestedGoal: prompt,
      targetDate: cleanString(context.targetDate, 40) || 'not supplied',
      currentProgress: cleanString(context.currentProgress, 120) || 'not supplied',
      availableTime: cleanString(context.availableTime, 200) || 'not supplied',
      constraints: cleanString(context.constraints, 500) || 'none supplied',
      clarificationAnswers: cleanString(context.additionalDetails, 1200) || 'none',
      clarificationTranscript: cleanString(context.clarificationTranscript, 2400) || 'none',
      clarificationResolved: context.clarificationResolved === 'true' || Number(context.clarificationRound ?? 0) >= 1,
      today: new Date().toISOString().slice(0, 10),
    };

    const { data: quotaRows, error: quotaError } = await authClient.rpc('reserve_ai_goal_plan_generation');
    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if (quotaError || !quota) {
      console.error('AI quota reservation failed:', quotaError?.message ?? 'no result');
      return json({ error: 'The AI planner usage controls are not configured yet.' }, 503);
    }
    if (!quota.allowed) {
      const message = quota.denial_reason === 'user_limit_reached'
        ? `You have used this month's ${quota.request_limit} AI plans. DOIT will use its built-in planner until the limit resets.`
        : 'DOIT has reached its protected monthly AI budget. The built-in planner is still available.';
      return json({ error: message, code: quota.denial_reason }, 429);
    }
    quotaReserved = true;
    const maxPlanning = Number(quota.request_limit ?? 0) >= 150;
    const tierInstruction = maxPlanning
      ? '\n\nDOIT MAX PLANNING PASS: Think more deeply about dependencies, likely failure points, sequencing, and the user’s stated constraints. Make every milestone independently verifiable and make today’s actions resilient by including a concrete done condition or fallback in each description. Do not add generic planning work.'
      : '';

    let parsed: any;
    let issue = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('OPENAI_GOAL_MODEL') ?? 'gpt-5.6-luna',
          reasoning: { effort: maxPlanning ? 'medium' : 'low' },
          store: false,
          max_output_tokens: 1800,
          input: [
            { role: 'system', content: `${systemPrompt}${tierInstruction}` },
            { role: 'user', content: `${JSON.stringify(userInput)}${attempt ? `\n\nQUALITY RETRY: The prior plan was rejected for ${issue}. Produce a genuinely specific replacement.` : ''}` },
          ],
          text: { format: { type: 'json_schema', name: 'doit_goal_plan', strict: true, schema: planSchema } },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      inputTokens += Number(payload?.usage?.input_tokens ?? 0);
      outputTokens += Number(payload?.usage?.output_tokens ?? 0);
      if (!response.ok) {
        console.error('OpenAI goal planner error', response.status, payload?.error?.code ?? payload?.error?.type ?? 'unknown');
        throw new Error(response.status === 429 ? 'The AI planner is busy. Try again in a moment.' : 'The AI planner could not generate a plan.');
      }
      parsed = JSON.parse(extractOutputText(payload));
      if (parsed.kind === 'clarification') {
        // Once answers have been supplied, use the second internal attempt to
        // produce a plan rather than sending the person through another form.
        if (userInput.clarificationResolved && attempt === 0) {
          issue = 'a repeated clarification after the user already answered';
          continue;
        }
        if (userInput.clarificationResolved) throw new Error('The AI repeated an answered clarification.');
        const questions = Array.isArray(parsed.questions) ? uniqueQuestions(parsed.questions) : [];
        if (!questions.length) throw new Error('The AI planner needs more detail but did not provide a question.');
        await recordUsage(supabaseUrl, serviceRoleKey, user.id, true, inputTokens, outputTokens);
        usageRecorded = true;
        return json({ type: 'clarification', message: cleanString(parsed.clarificationMessage, 300) || 'I need a little more detail before I build this properly.', questions });
      }
      issue = qualityIssue(parsed);
      if (!issue) break;
    }

    if (issue) {
      console.error('AI goal plan failed quality validation:', issue);
      await recordUsage(supabaseUrl, serviceRoleKey, user.id, false, inputTokens, outputTokens);
      usageRecorded = true;
      return json({ error: 'DOIT could not make that plan specific enough. Add one more detail and try again.' }, 422);
    }

    const result = {
      goal: {
        title: cleanString(parsed.goal.title, 140),
        description: cleanString(parsed.goal.description, 500),
        targetValue: Number(parsed.goal.targetValue),
        unit: cleanString(parsed.goal.unit, 40),
      },
      milestones: parsed.milestones.slice(0, 5).map((item: any) => ({ title: cleanString(item.title, 160), description: cleanString(item.description, 400), targetValue: Number(item.targetValue) })),
      todayTasks: parsed.todayTasks.slice(0, 4).map((item: any) => ({ title: cleanString(item.title, 180), description: cleanString(item.description, 500), priority: item.priority, estimatedMinutes: Math.max(5, Math.min(90, Math.round(Number(item.estimatedMinutes)))) })),
      insight: cleanString(parsed.insight, 500),
    };
    await recordUsage(supabaseUrl, serviceRoleKey, user.id, true, inputTokens, outputTokens);
    usageRecorded = true;
    return json(result);
  } catch (error) {
    if (quotaReserved && !usageRecorded && usageUserId && usageSupabaseUrl) {
      await recordUsage(usageSupabaseUrl, usageServiceRoleKey, usageUserId, false, inputTokens, outputTokens);
    }
    const message = error instanceof Error ? error.message : 'The AI planner failed.';
    console.error('Goal planner failure:', message);
    return json({ error: message }, 500);
  }
});
