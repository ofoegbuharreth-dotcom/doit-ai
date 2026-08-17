# DOIT AI Android release setup

The app code is release-ready, but the services below still need real project credentials. Never put secret server keys in `.env` or commit them.

## 1. Google Play and RevenueCat

1. Create DOIT AI in Google Play Console with package `com.doitai.app`.
2. Upload a signed production `.aab` to an internal testing track. Google Play products are not reliably testable from a locally installed debug build.
3. Under **Monetize > Products > Subscriptions**, create DOIT Pro and DOIT MAX subscriptions, with monthly/annual base plans and any 7-day trial offer. Activate every base plan and offer.
4. Create the `doit_pro` entitlement and a current offering in RevenueCat. Attach the Google Play monthly and annual products to packages in that offering.
5. Add the RevenueCat **public Android SDK key** to the production build environment as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Set `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=doit_pro`.
6. Add tester Gmail accounts to the Play internal test and license-test lists, then install DOIT AI using the Play opt-in link.

Do not use a RevenueCat secret key in the app. The paywall displays Google Play's localized price and sends purchases through the Play purchase sheet. Cancellation opens the account's real Google Play management page.

## 2. Supabase

Deploy `supabase/migrations/008_release_subscriptions.sql`. Keep the existing `send-cancellation-feedback` Edge Function deployed so cancellation feedback can be emailed.

For production, validate all Pro-only operations on the server using RevenueCat webhooks or trusted entitlement records. Client-side feature gates improve UX but are not a security boundary.

## 3. Sentry crash reporting

1. Create a React Native project in Sentry and set `EXPO_PUBLIC_SENTRY_DSN` in the production build environment.
2. Add secret EAS environment variables `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` so production source maps upload during builds.
3. Make one internal-test build, trigger a controlled test error, and confirm the event is symbolicated in Sentry before rollout.

Sentry is disabled in development and is configured without default personally identifiable information.

## 4. PostHog product analytics

1. Create a PostHog project in the correct region.
2. Set `EXPO_PUBLIC_POSTHOG_API_KEY` and its matching `EXPO_PUBLIC_POSTHOG_HOST` in the production build environment.
3. Confirm onboarding, account, goal, focus, paywall, and subscription events in Live Events.

Goal titles, action text, email addresses, and cancellation details are not sent to PostHog. Users can disable product analytics from Profile.

## 5. Required Play listing work

- Publish a public privacy-policy URL and add it to the Play listing and inside the app before production review.
- Complete Play Console Data safety and Account deletion declarations accurately for Supabase, Sentry, PostHog, and RevenueCat.
- Add store screenshots, feature graphic, support email, content rating, target audience, and subscription terms.
- Run closed/internal testing on multiple screen sizes and Android versions, including offline, expired session, purchase, restore, renewal, cancellation, and refund scenarios.

## Build commands

```powershell
npm run typecheck
npm test
npm run lint
npx expo prebuild --platform android
npm run build:android:production
npm run submit:android
```
