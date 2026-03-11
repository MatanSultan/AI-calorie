# CalorieLens

CalorieLens is a production-ready full-stack calorie tracking app built with Next.js 15 + Supabase.

Core capabilities:
- AI meal analysis from image, text, or both
- Streaming meal-focused chat for follow-up clarification
- Manual correction before saving
- Persistent history across devices
- Hebrew-first UX with RTL and optional English
- Supabase Auth, Postgres, and Storage with RLS

## Tech Stack
- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Reusable shadcn-style component primitives
- Supabase (Auth, Postgres, Storage)
- AI provider abstraction (`Groq` / `OpenAI` with local vision fallback)
- Zod validation and defensive server-side parsing

## Project Structure

```txt
src/
  app/
    (auth)/
      sign-in/
      sign-up/
      onboarding/
      actions.ts
    (app)/
      dashboard/
      history/
      profile/
      layout.tsx
    api/
      ai/analyze/
      ai/chat/
      uploads/
      meals/finalize/
    auth/callback/
    layout.tsx
    page.tsx
  components/
    dashboard/
    layout/
    providers/
    ui/
  lib/
    ai/
      providers/
    i18n/
    supabase/
    validation/
    env.ts
    types.ts
    utils.ts
supabase/
  migrations/
    001_init.sql
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill it:

```bash
cp .env.example .env.local
```

3. Configure Supabase SQL schema:
- Open Supabase SQL editor
- Run the migration in `supabase/migrations/001_init.sql`

4. Run app locally:

```bash
npm run dev
```

## How to Connect Supabase

1. Create a Supabase project.
2. Copy project URL and anon key from `Project Settings > API`.
3. Set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Run migration SQL (`001_init.sql`) to create tables, triggers, RLS, and storage policies.
5. Ensure storage bucket `meal-images` exists (migration creates it if missing).

## Where to Put Groq API Key

Set this in `.env.local`:

```env
GROQ_API_KEY=your_real_key_here
```

Optional model overrides:

```env
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
```

If Groq/OpenAI vision is unavailable, the app automatically falls back to a local vision model for image-first food analysis.

## How to Swap Groq Provider Later

Provider entrypoint is `src/lib/ai/index.ts`.

- `getAIProvider()` currently returns `GroqAIProvider` when `GROQ_API_KEY` exists, otherwise `MockAIProvider`.
- Add a new provider class under `src/lib/ai/providers/` that implements `AIProvider` from `src/lib/ai/types.ts`.
- Update `getAIProvider()` selection logic by env flag (for example: `AI_PROVIDER=openai`).

No UI code changes are needed because routes consume the provider interface, not a specific SDK.

## Security Notes

- AI calls run server-side only (`/api/ai/*`).
- Service role key is never exposed to client.
- `SUPABASE_SERVICE_ROLE_KEY` is optional but recommended for robust server-side image uploads.
- Uploads are validated for MIME and size with zod.
- Meal data is tied to authenticated user IDs.
- RLS policies enforce per-user access in all user-owned tables.

## Deployment (Vercel)

1. Push repository to Git provider.
2. Import project in Vercel.
3. Add environment variables from `.env.example` in Vercel project settings.
4. Ensure Supabase migration has been run in production project.
5. Deploy.

Recommended post-deploy checks:
- Sign up/sign in flow
- Upload image and analyze meal
- Save and read from history on a second device
- Language toggle and RTL rendering


