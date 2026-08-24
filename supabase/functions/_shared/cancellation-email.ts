// @ts-nocheck -- Shared by Supabase Edge Functions running in Deno.
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);

export type CancellationEmailPayload = {
  userEmail?: string | null;
  userId: string;
  previousPlan: string;
  reason: string;
  details: string;
  submittedAt: string;
  source: 'stripe_webhook' | 'feedback_form';
  idempotencyKey?: string;
};

export async function sendCancellationOwnerEmail(payload: CancellationEmailPayload) {
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const feedbackTo = Deno.env.get('FEEDBACK_TO_EMAIL')?.trim() || 'ofoegbuharreth@gmail.com';
  const feedbackFrom = Deno.env.get('FEEDBACK_FROM_EMAIL')?.trim() || 'DOIT AI <onboarding@resend.dev>';
  const logoUrl = Deno.env.get('APP_LOGO_URL');
  if (!resendKey) throw new Error('Configuration: RESEND_API_KEY is missing.');
  if (!feedbackTo.includes('@')) throw new Error('Configuration: FEEDBACK_TO_EMAIL is invalid.');

  const userLabel = payload.userEmail ?? payload.userId;
  const planDisplay = payload.previousPlan === 'max' || payload.previousPlan === 'premium' ? 'DOIT MAX' : 'DOIT Pro';
  const submitted = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(payload.submittedAt));
  const sourceLabel = payload.source === 'stripe_webhook' ? 'Confirmed in Stripe' : 'Submitted before opening Stripe';
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="62" height="62" alt="DOIT AI" style="display:block;width:62px;height:62px;border:0;border-radius:16px;" />`
    : '<div style="width:62px;height:62px;border-radius:16px;background:#6f42ff;color:#ffffff;font:700 24px Arial,sans-serif;line-height:62px;text-align:center;">D✓</div>';
  const html = `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background:#070812;color:#f5f7ff;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070812;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#111321;border:1px solid #25283a;border-radius:24px;overflow:hidden;"><tr><td style="height:6px;background:linear-gradient(90deg,#3155ff 0%,#7747ff 48%,#cb4cff 100%);font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:34px 36px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="78" valign="middle">${logo}</td><td valign="middle"><div style="font-size:12px;line-height:18px;font-weight:700;letter-spacing:2px;color:#a68cff;">DOIT AI</div><div style="font-size:25px;line-height:34px;font-weight:700;color:#ffffff;">${escapeHtml(planDisplay)} subscription cancelled</div></td></tr></table></td></tr><tr><td style="padding:0 36px 24px;"><p style="margin:0;color:#aeb3c7;font-size:15px;line-height:24px;">A user cancelled ${escapeHtml(planDisplay)}. ${escapeHtml(sourceLabel)}.</p></td></tr><tr><td style="padding:0 36px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#191c2d;border:1px solid #2a2e45;border-radius:16px;"><tr><td style="padding:22px 24px;"><div style="font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.6px;color:#8e94aa;text-transform:uppercase;">Main reason</div><div style="padding-top:7px;font-size:21px;line-height:30px;font-weight:700;color:#ffffff;">${escapeHtml(payload.reason)}</div></td></tr></table></td></tr><tr><td style="padding:0 36px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f1a;border:1px solid #242739;border-radius:16px;"><tr><td style="padding:18px 22px;border-bottom:1px solid #242739;"><div style="font-size:11px;line-height:16px;color:#7f859a;text-transform:uppercase;letter-spacing:1.2px;">User</div><div style="padding-top:5px;color:#f5f7ff;font-size:15px;line-height:22px;">${escapeHtml(userLabel)}</div></td><td style="padding:18px 22px;border-bottom:1px solid #242739;"><div style="font-size:11px;line-height:16px;color:#7f859a;text-transform:uppercase;letter-spacing:1.2px;">Previous plan</div><div style="padding-top:5px;color:#f5f7ff;font-size:15px;line-height:22px;">${escapeHtml(planDisplay)}</div></td></tr><tr><td colspan="2" style="padding:18px 22px;"><div style="font-size:11px;line-height:16px;color:#7f859a;text-transform:uppercase;letter-spacing:1.2px;">Recorded</div><div style="padding-top:5px;color:#f5f7ff;font-size:15px;line-height:22px;">${escapeHtml(submitted)} UK time</div></td></tr></table></td></tr><tr><td style="padding:0 36px 30px;"><div style="padding:22px 24px;background:#171329;border-left:4px solid #8a5cff;border-radius:4px 16px 16px 4px;"><div style="font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#a68cff;text-transform:uppercase;">Details</div><div style="padding-top:10px;color:#e8e9f2;font-size:16px;line-height:26px;white-space:pre-wrap;">${escapeHtml(payload.details || 'No additional comments were provided.')}</div></div></td></tr><tr><td style="padding:22px 36px;background:#0b0d16;border-top:1px solid #202334;"><p style="margin:0;color:#747a90;font-size:12px;line-height:19px;">Sent securely by the DOIT AI billing system.${payload.userEmail ? ` Replying to this email will reply directly to ${escapeHtml(userLabel)}.` : ''}</p></td></tr></table><div style="padding:18px 8px 0;color:#555b70;font-size:11px;line-height:18px;">DOIT AI · Turn goals into momentum.</div></td></tr></table></body></html>`;
  const idempotencyKey = payload.idempotencyKey ?? `doit-cancellation-${payload.source}-${payload.userId}-${payload.submittedAt.slice(0, 13)}`;

  const sendEmail = async (from: string, attempt: string) => {
    try {
      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${idempotencyKey}-${attempt}` },
        body: JSON.stringify({
          from,
          to: [feedbackTo],
          ...(payload.userEmail ? { reply_to: payload.userEmail } : {}),
          subject: `DOIT AI cancellation · ${payload.reason}`,
          html,
          text: [`DOIT AI — ${planDisplay} subscription cancelled`, ``, `User: ${userLabel}`, `Previous plan: ${payload.previousPlan}`, `Reason: ${payload.reason}`, `Details: ${payload.details || 'No additional comments'}`, `Recorded: ${submitted} UK time`, `Source: ${sourceLabel}`].join('\n'),
        }),
      });
    } catch (error) {
      throw new Error(`Network: ${error instanceof Error ? error.message : 'Resend could not be reached.'}`);
    }
  };

  // Remote CID attachments made delivery less reliable on Resend. The logo is
  // now loaded by URL while the message itself remains a normal lightweight
  // HTML email, matching the version that delivered reliably before.
  let email = await sendEmail(feedbackFrom, 'primary');
  if (!email.ok && !feedbackFrom.includes('onboarding@resend.dev')) email = await sendEmail('DOIT AI <onboarding@resend.dev>', 'sandbox-sender');
  if (!email.ok) {
    let providerMessage = `Resend returned ${email.status}.`;
    try {
      const parsed = JSON.parse(await email.text());
      if (typeof parsed?.message === 'string') providerMessage = parsed.message;
    } catch { /* Keep the safe status-only message. */ }
    throw new Error(`Provider: ${providerMessage}`);
  }
  const accepted = await email.json().catch(() => ({ accepted: true }));
  console.info('Cancellation email accepted by Resend.', { emailId: accepted?.id ?? null, source: payload.source });
  return accepted;
}

export function cancellationReasonLabel(reason: string) {
  const reasonLabels: Record<string, string> = {
    too_expensive: 'Too expensive',
    not_using_enough: 'Not using it enough',
    missing_features: 'Missing features',
    difficult_to_use: 'Difficult to use',
    technical_issues: 'Technical issues',
    stripe_cancel: 'Cancelled in Stripe',
    other: 'Other',
  };
  return reasonLabels[reason] ?? reason;
}
