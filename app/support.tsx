import { LegalPage } from '@/components/web/LegalPage';

const sections = [
  { title: 'Account and sign-in', body: 'If an email link does not arrive, check spam, wait at least 60 seconds before resending, and confirm you entered the right address. Verification links must be opened on the device where you want to continue.' },
  { title: 'Plans and progress', body: 'Open a goal to log measurable progress. Use DOIT Coach when an action no longer fits; describe what changed and ask it to move, replace, shorten, or schedule the action.' },
  { title: 'Web subscriptions', body: 'Open Profile, choose DOIT Pro or DOIT MAX, then Manage subscription. Stripe opens securely so you can switch billing interval, change plan, update payment details or cancel. A scheduled cancellation keeps paid access available until the displayed period end. Stripe sends receipts and billing notices to the email attached to the Stripe customer.' },
  { title: 'Native Android subscriptions', body: 'A future Google Play release may manage purchases through Google Play instead of Stripe. In that build, use the Google Play subscriptions screen linked from DOIT. Include the Google account used for the purchase when contacting support, but never send card details or passwords.' },
  { title: 'Charges and billing problems', body: 'For help with an incorrect charge, failed payment, missing entitlement or plan switch, email ofoegbuharreth@gmail.com with your DOIT account email, the approximate charge date and whether you paid on web or Android. Never include a full card number, password or verification code.' },
  { title: 'Bug reports', body: 'Tell us what you expected, what happened, your device or browser, and the steps that reproduce the problem. A screenshot is helpful when it does not contain sensitive information.' },
  { title: 'Response and urgent issues', body: 'Support is provided by email and responses are not guaranteed instantly. DOIT AI is a productivity service, not an emergency, medical, legal or financial service. For an urgent safety issue, contact the appropriate local emergency or professional service.' },
];

export default function SupportScreen() {
  return <LegalPage title="Support" intro="Quick answers and a direct way to reach the DOIT AI team." sections={sections} />;
}
