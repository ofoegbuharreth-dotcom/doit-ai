// @ts-nocheck -- This file runs in Supabase's Deno Edge runtime, not Expo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cancellationReasonLabel, sendCancellationOwnerEmail } from '../_shared/cancellation-email.ts';

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  let diagnosticAdmin: ReturnType<typeof createClient> | undefined;
  let diagnosticFeedbackId: string | undefined;
  if (request.method === 'OPTIONS') return new Response('ok');
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in before sending cancellation feedback.' }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user: requester }, error: requesterError } = await userClient.auth.getUser();
    if (requesterError || !requester) return json({ error: 'Your session expired. Please sign in again.' }, 401);
    const { feedbackId } = await request.json();
    if (typeof feedbackId !== 'string') return json({ error: 'Missing feedback id.' }, 400);
    diagnosticFeedbackId = feedbackId;

    const admin = createClient(url, serviceKey);
    diagnosticAdmin = admin;
    const { data: feedback, error: feedbackError } = await admin.from('subscription_cancellation_feedback').select('*').eq('id', feedbackId).single();
    if (feedbackError || !feedback) return json({ error: 'Feedback not found.' }, 404);
    if (feedback.user_id !== requester.id) return json({ error: 'Feedback not found.' }, 404);
    if (feedback.emailed_at) return json({ sent: true, duplicate: true });
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(feedback.user_id);
    const user = userResult?.user;
    if (userError || !user) throw new Error('The feedback user could not be loaded.');

    await sendCancellationOwnerEmail({
      userEmail: user.email,
      userId: feedback.user_id,
      previousPlan: feedback.previous_plan,
      reason: cancellationReasonLabel(feedback.reason),
      details: feedback.details || 'No additional comments were provided.',
      submittedAt: feedback.created_at,
      source: 'feedback_form',
    });
    await admin.from('subscription_cancellation_feedback').update({ emailed_at: new Date().toISOString(), email_error: null }).eq('id', feedback.id);
    return json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send feedback.';
    console.error('Cancellation email failed before delivery:', message);
    if (diagnosticAdmin && diagnosticFeedbackId) await diagnosticAdmin.from('subscription_cancellation_feedback').update({ email_error: message.slice(0, 500) }).eq('id', diagnosticFeedbackId);
    return json({ error: message }, 500);
  }
});
