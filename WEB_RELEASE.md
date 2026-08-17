# DOIT AI web release

The production web app is generated in `dist/` with:

- responsive landing page and full signed-in app;
- PWA manifest and install support;
- service-worker caching;
- Cloudflare Pages SPA routing;
- web-safe email verification and calendar downloads;
- privacy, terms, support, and account-deletion pages.

## Build

```powershell
cd "C:\Users\Awake\Desktop\DOIT Ai"
npm run build:web
```

The build command moves Expo's browser bundle into `dist/expo-static`. This avoids direct-upload ZIP tools omitting the original underscore-prefixed `_expo` directory.

## Publish free with Cloudflare Pages

1. Sign in at <https://dash.cloudflare.com/>.
2. Open **Workers & Pages** and choose **Create application**.
3. Choose **Pages** and **Upload assets** (direct upload).
4. Use `doit-ai` as the project name.
5. Upload the contents of the generated `dist` folder.
6. Deploy. The permanent production address is `https://doit-ai.pages.dev`.

No custom domain is required. Rebuild and upload `dist` whenever the app changes.

The CLI alternative is `npm run deploy:web`, but it requires a Cloudflare API token in the `CLOUDFLARE_API_TOKEN` environment variable.

## Connect Supabase after publishing

In Supabase, open **Authentication > URL Configuration**:

1. Set **Site URL** to `https://doit-ai.pages.dev`.
2. Add `https://doit-ai.pages.dev/auth/callback` to **Redirect URLs**.
3. Keep `doit://auth/callback` in the redirect list for the Android app.
4. Ensure a customised confirmation email uses `{{ .RedirectTo }}` for its confirmation destination.

Test signup, email confirmation, login, password reset, and account deletion on the published URL before sharing it.

## Remaining production services

- Deploy `generate-goal-plan`, set the server-side `OPENAI_API_KEY`, and use `EXPO_PUBLIC_AI_MODE=hybrid` before calling AI planning production-ready.
- Add the Sentry and PostHog public values in the production build environment.
- Connect all four live Stripe Prices before enabling paid checkout on web: Pro monthly/annual use `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_ANNUAL_PRICE_ID`; MAX monthly/annual use `STRIPE_MAX_MONTHLY_PRICE_ID` and `STRIPE_MAX_ANNUAL_PRICE_ID`. The installed web app uses this same Stripe flow. Native store builds continue through Google Play and RevenueCat.
