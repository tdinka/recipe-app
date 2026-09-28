# Family Recipe Box

Self-hosted household recipe app: recipe management, weekly meal planning, and grocery lists, in a private household-based environment with optional public sharing.

## About the owner
- Tsega is early in their technical journey. Explain what you're doing in plain language, keep steps concrete and sequential, and say clearly when Tsega needs to do something themselves (e.g. in GitHub Desktop or on Railway).

## Stack
- Next.js 14 (App Router, TypeScript) + Tailwind CSS
- PostgreSQL on Railway, managed with Prisma
- Auth: NextAuth (credentials provider), household-based with invite codes
- Anthropic API for recipe import (vision + text extraction), model `claude-sonnet-5`
- Unsplash API for recipe photos (attribution fields are required)
- Hosting: Railway, live at recipe-app-production-3766.up.railway.app
- Repo: GitHub `recipe-app`; local folder `~/Projects/recipe-app`

## Shipped features
- Recipe import: URL (schema.org JSON-LD, microdata, plain-text fallbacks), screenshot/photo via vision, and paste-text path for sites that block fetches (Allrecipes, NYT Cooking)
- Categorization, tagging, search; category/tag parsing handles comma-joined strings
- Weekly meal plan calendar
- Grocery list with ingredient aggregation and serving scaling (½×, 1×, 2×, 3×)
- Public read-only sharing via tokenized links: `/share/[token]`, `/share/[token]/[recipeId]`
- Image proxy route `/api/image-proxy` (fixes cross-origin image blocking)
- Settings page: household name, invite code, share-link toggle
- Backfill routes for cooking times and messy category data
- Mobile: bottom tab bar, cook mode, home-screen install (Recipe Box + family Groceries list link)

## In progress: family grocery list tool
- Shared by web link, anyone in the family can add items; very simple UX
- Items auto-sorted by grocery section, with quantities; default store Vons, alternates Trader Joe's, Costco, Amazon
- Check off while shopping; purchased items go straight to an archive for easy re-add
- One always-on running list; shared secret link, no login; no prices in v1; in-store view filtered by store, then section; live sync within a few seconds
- Recipe/meal-plan ingredients added manually (only what isn't already in the pantry/fridge)
- Phone push notifications (home-screen app) to Tsega only when items are added

## Workflow
- Git: Tsega commits and pushes through GitHub Desktop and reviews diffs there. Don't run `git commit`/`git push` unless asked; when a change is ready, say so and summarize what to look for in the diff.
- Deploy: pushing to GitHub does NOT deploy. After Push origin, Tsega must click "Apply changes"/"Deploy" on the Railway project canvas. Environment variable changes on Railway also need "Apply changes".
- One-time data migrations are built as API backfill routes with a matching Settings UI card, following the existing batched pattern.

## Gotchas (important)
- Use `prisma db push`. NEVER `prisma migrate dev`: the DB was set up with db push, and migrate dev will try to reset it.
- Adding a non-nullable column to a table with rows: (1) add as nullable, (2) backfill via `prisma db execute --file`, (3) make required and push again.
- Back up `.env` and any local database files before doing file-management work; they've been lost before.
- Double-check Railway env var names exactly (a `NETAUTH_SECRET` typo once caused silent failures).
- Auth middleware covers routes broadly; new public routes (like `/share`) must be excluded from the NextAuth middleware matcher or they hit a login wall.
- Next.js 14.2.x: `useSearchParams` + `Suspense` + `force-dynamic` in a Server Component causes a stack overflow. Workaround: parse `window.location.search` directly.
- `export const dynamic = "force-dynamic"` is silently ignored in Client Components.
