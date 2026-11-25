# Letter League — Private Family Word Game

A React + TypeScript + Vite word-grid game with Supabase Edge Function validation, Supabase Realtime change notifications, and GitHub Pages deployment.

## Important architecture and privacy notes

- GitHub Pages hosts the static frontend. It is not a backend.
- Supabase Edge Functions validate room membership, host actions, board paths, dictionary words, deadlines, and scores.
- Supabase Postgres holds **temporary room state** (including temporary nicknames, player tokens, scores and submissions) while a room is active. This is necessary for a stateless Edge Function to coordinate and validate multiplayer actions. It is not a permanent profile or game-history store.
- Rooms expire after three hours of inactivity; requests also opportunistically delete expired rows. Enable scheduled cleanup if your Supabase plan supports `pg_cron`.
- This starter uses an anonymous random browser token held in `sessionStorage`; it is not an account, but it is a temporary pseudonymous identifier.
- The Edge Function uses a service-role key only on the server. Never put that key in Vite variables or GitHub Pages.
- Supabase infrastructure may process IP addresses and technical metadata under its own policies.
- The included dictionary is intentionally a compact starter list, not a comprehensive English dictionary. Replace it with a reviewed, openly licensed word list before calling this production-ready.
- The included server writes use an Edge Function read/modify/upsert pattern. For high-concurrency production play, replace this with a transactional Postgres RPC using row locks / optimistic version checks. This starter is suitable for a family pilot, not a security audit or competitive tournament.
- Supabase Realtime notifications are used to prompt clients to refresh; a five-second polling fallback is included.

## Requirements

- Node.js 22+
- npm
- A Supabase project
- A GitHub account

## Run locally

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase project URL and publishable/anon key
npm run dev
```

Run tests and build:

```bash
npm test
npm run build
```

## Supabase setup

1. Create a free project at https://supabase.com/dashboard.
2. In the SQL Editor, run `supabase/migrations/202611250001_ephemeral_game_rooms.sql`.
3. Deploy the Edge Function from this project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy game --no-verify-jwt
```

4. Set the Edge Function's server-side secrets. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions by default. Confirm this in the project dashboard. Do not expose the service-role key to the browser.
5. In Project Settings → API, copy the Project URL and publishable key (or legacy anon key) into `.env.local`.
6. The function currently allows browser CORS from any origin. For a stricter deployment, replace `Access-Control-Allow-Origin: *` in `supabase/functions/_shared/cors.ts` with your exact GitHub Pages origin.

The `game_rooms` table has RLS enabled and no client policies. The frontend does not query room data directly; it calls the Edge Function.

## Deploying updates to an existing project

A GitHub Pages deployment updates only the website. If files under `supabase/functions/` change, deploy the Edge Function separately from the project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy game --no-verify-jwt
```

The `supabase link` step is needed only once on a computer. For this update, the server-side word-path helper changed so the Q tile correctly counts as `QU`; deploy the `game` function after pushing the frontend update.

## GitHub Pages deployment

1. Create a **public** repository named `family-word-game` (or any name).
2. Upload/commit all project files to the `main` branch.
3. In repository Settings → Secrets and variables → Actions, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In repository Settings → Pages, set Source to **GitHub Actions**.
5. Push to `main`. The workflow builds and deploys automatically.
6. Your URL is `https://YOUR_GITHUB_USERNAME.github.io/REPOSITORY_NAME/`.

The Vite config derives the GitHub Pages base path from `GITHUB_REPOSITORY`, so project repository paths are handled automatically.

## Play

Create a room with a nickname, share the room invitation URL, and have another player join. Each room has exactly one host: the player who created it. Only that host can start or replay a round; the Edge Function checks this on the server. During a round, drag or slide across adjacent letter tiles to submit a word, or use the typing field. Optional, low-volume synthesized background music can be switched on or off by each player.

## Before wider release

- Replace the starter dictionary with a complete openly licensed word list and include its license/attribution.
- Add a transactional server-side database function or another concurrency-safe room state mechanism.
- Add rate limiting at the edge/API layer and abuse controls.
- Add stronger automated integration tests for multi-client concurrency, expiry, reconnect, and authorization.
- Review Supabase free-tier limits and provider privacy policies.
- Verify room expiration and scheduled cleanup in the deployed project.
- Review the privacy notice with the actual provider settings and retention configuration.

## Free-tier caveat

GitHub Pages and Supabase have plan limits, quotas, fair-use terms, and service availability policies that can change. A free plan is not a guarantee of unlimited hosting or uptime. No paid service is required by this code, but exceeding a free tier can require waiting, reducing usage, or upgrading.
