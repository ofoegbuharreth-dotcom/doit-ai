# DOIT AI

Premium goal-execution app foundation built with Expo SDK 54, React Native, TypeScript, and Expo Router.

## Run locally

```bash
npm install
npx expo start
```

## Quality checks

```bash
npm run typecheck
npm run lint
```

## Supabase

1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`.
2. Copy `.env.example` to `.env` and add the project URL and anon key.
3. Use `EXPO_PUBLIC_AI_MODE=hybrid` for AI-generated goal plans with a local fallback. Use `mock` only for fully offline development.

Never put an AI provider secret in an `EXPO_PUBLIC_` value. The remote AI adapter calls server-side Supabase Edge Functions and validates their responses before use.

## Included V1

Premium onboarding, Supabase auth, a four-tab dashboard, hybrid AI goal generation with strict server-side quotas and a local fallback, milestones, daily task actions, animated progress, daily check-ins, activity history, profile/settings, RLS-ready database schema, reusable design and motion systems, and a switchable AI provider abstraction.

## V2.1 agent foundation

Apply `supabase/migrations/002_v2_agent_foundation.sql` after the V1 migration. It only extends the existing schema and does not recreate or delete V1 data.

V2.1 adds typed calendar, recurrence, dependency, preference, inbox, focus, agent-action, review, notification, and snapshot models. Agent responses use strict Zod schemas, relevant-only context building, confirmation previews, ownership preflight checks, a scoped action executor, and an RLS-protected Supabase gateway. User-facing Agent UI begins in V2.2.
