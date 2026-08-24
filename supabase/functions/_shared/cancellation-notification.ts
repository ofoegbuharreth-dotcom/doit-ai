// @ts-nocheck -- Shared by Supabase Edge Functions running in Deno.
import { cancellationReasonLabel, sendCancellationOwnerEmail } from './cancellation-email.ts';

function subscriptionPeriodEnd(subscription: any) {
  const seconds = subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : null;
}

function formatPeriodEnd(value?: string | null) {
  if (!value) return 'the end of the current billing period';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(value));
}

export async function notifyOwnerOfStripeCancellation(admin: any, userId: string, stripeSubscription: any, previousPlan = 'pro') {
  const { data: existing, error: existingError } = await admin
    .from('subscriptions')
    .select('cancellation_notified_at, cancellation_email_error')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.cancellation_notified_at) return { duplicate: true };

  const attemptAt = new Date().toISOString();
  await admin.from('subscriptions').update({ cancellation_email_last_attempt_at: attemptAt }).eq('user_id', userId);

  try {
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError) throw userError;
    const user = userResult?.user;

    const { data: feedback, error: feedbackError } = await admin
      .from('subscription_cancellation_feedback')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (feedbackError) throw feedbackError;

    const periodEnd = subscriptionPeriodEnd(stripeSubscription);
    const cancelledNow = String(stripeSubscription.status ?? '') === 'canceled';
    const stripeDetails = cancelledNow
      ? 'The subscription was cancelled immediately in Stripe.'
      : `The customer confirmed cancellation in Stripe. Access continues until ${formatPeriodEnd(periodEnd)}.`;
    const reason = feedback ? cancellationReasonLabel(feedback.reason) : cancellationReasonLabel('stripe_cancel');
    const details = feedback?.details ? `${feedback.details}\n\n${stripeDetails}` : stripeDetails;
    const submittedAt = feedback?.created_at ?? attemptAt;
    const plan = feedback?.previous_plan ?? previousPlan ?? 'pro';

    const previousDeliveryFailed = /^(Provider|Network):/.test(String(existing?.cancellation_email_error ?? ''));
    await sendCancellationOwnerEmail({
      userEmail: user?.email,
      userId,
      previousPlan: plan,
      reason,
      details,
      submittedAt,
      source: 'stripe_webhook',
      // Preserve the stable key after an accepted request/database failure so
      // replay cannot duplicate mail. A known provider/network rejection gets
      // a fresh key, allowing a repaired Resend configuration to really retry.
      idempotencyKey: `doit-stripe-cancellation-${stripeSubscription?.id ?? userId}${previousDeliveryFailed ? `-retry-${attemptAt.replace(/\D/g, '')}` : ''}`,
    });

    const notifiedAt = new Date().toISOString();
    const { error: notifiedError } = await admin.from('subscriptions').update({
      cancellation_notified_at: notifiedAt,
      cancellation_email_error: null,
      cancellation_email_last_attempt_at: notifiedAt,
    }).eq('user_id', userId);
    if (notifiedError) throw notifiedError;
    if (feedback && !feedback.emailed_at) {
      const { error: feedbackUpdateError } = await admin.from('subscription_cancellation_feedback').update({ emailed_at: notifiedAt, email_error: null }).eq('id', feedback.id);
      if (feedbackUpdateError) throw feedbackUpdateError;
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send cancellation email.';
    await admin.from('subscriptions').update({
      cancellation_email_error: message.slice(0, 500),
      cancellation_email_last_attempt_at: new Date().toISOString(),
    }).eq('user_id', userId);
    throw error;
  }
}
