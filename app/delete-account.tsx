import { LegalPage } from '@/components/web/LegalPage';

const sections = [
  { title: 'Delete inside DOIT AI', body: 'Sign in, open Profile, tap Delete account, type Delete exactly, and confirm. This permanently removes your account and its goals, actions, progress, and check-ins.' },
  { title: 'If you cannot sign in', body: 'Email support from the address attached to your DOIT AI account and ask for account deletion. We may need to verify ownership before processing the request.' },
  { title: 'Subscriptions are separate', body: 'Deleting your DOIT AI account does not automatically cancel a subscription. On web, open Manage subscription and cancel it in Stripe first. In a native Android store release, cancel it through Google Play. Then return to DOIT and delete the account.' },
];

export default function DeleteAccountScreen() {
  return <LegalPage title="Delete your account" intro="You stay in control of your DOIT AI account and data." sections={sections} />;
}
