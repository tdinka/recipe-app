# Family Recipe Box

A self-hosted app for collecting recipes from around the web, organizing them, and turning them into weekly meal plans and grocery lists — shared with your household.

## What it does

- **Import by link** — paste a URL from most recipe sites and it pulls in the title, photo, ingredients, instructions, prep/cook time, and servings automatically (it reads the structured recipe data almost all recipe sites embed for Google/search; if a site doesn't have that, you can still add the recipe by hand).
- **Import from a screenshot** — for sites that block scraping or don't publish structured data, upload a screenshot of the recipe (or a photo of a cookbook page / recipe card) and Claude's vision reads it into the same editable review screen. Requires an Anthropic API key (see setup below) — optional, everything else works without it.
- **Categorize & browse** — every recipe gets a category (Dinner, Dessert, etc.), an optional cuisine, and free-form tags. Filter and search your whole collection.
- **Meal planning** — a weekly calendar where you drop recipes onto specific days and meals.
- **Grocery lists** — generate a shopping list from any date range of your meal plan; ingredients from all those recipes are combined automatically. Add your own items too, and check things off as you shop.
- **Family accounts** — one household, multiple logins. Whoever creates the household gets an invite code to share with family members.

## Tech stack

Next.js 14 (App Router, TypeScript) + Prisma + Postgres + NextAuth + Tailwind CSS. It's a single deployable app — no separate backend to run.

---

## 1. Local setup

Requirements: Node.js 18.18+ (20 LTS recommended), npm, and a Postgres database — the easiest way to get one for free is a small database on [Railway](https://railway.app) (see Deploying below), used both locally and in production.

```bash
npm install
cp .env.example .env
```

Open `.env` and set:

- `DATABASE_URL` — your Postgres connection string, e.g. `postgresql://user:password@host:port/railway`
- `NEXTAUTH_SECRET` — generate one with `openssl rand -base64 32`
- `NEXTAUTH_URL` — leave as `http://localhost:3000` for local dev
- `ANTHROPIC_API_KEY` — optional, only needed for the "Upload a screenshot" recipe import. Get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (this is a separate developer account from claude.ai — it bills per API call, typically a fraction of a cent per screenshot). Leave blank to skip this feature entirely.

Create the database tables:

```bash
npm run db:push
```

Start the dev server:

```bash
npm run dev
```

Visit `http://localhost:3000`, click **Create a household**, and you're in. Share the invite code shown after signup with family members so they can join the same household from the **Join with a code** tab on the register page.

## 2. Deploying (Railway)

Railway builds and runs the app for you — no server administration, no keeping a terminal tab open.

1. **Push this code to a GitHub repository** (a private one is fine). If you're not already using git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Then create an empty repo on [github.com/new](https://github.com/new) and follow the "push an existing repository" instructions it shows you.
2. **On Railway**, create a new project → *Deploy from GitHub repo* → select this repo.
3. **Add a Postgres database** to the same Railway project (New → Database → PostgreSQL). Railway automatically makes its connection string available to your app service as a variable.
4. **Set environment variables** on your app service in Railway: `DATABASE_URL` (reference the Postgres service's variable, e.g. `${{Postgres.DATABASE_URL}}`), `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your Railway-provided domain, e.g. `https://your-app.up.railway.app`), and `ANTHROPIC_API_KEY` if you're using screenshot import.
5. Railway runs `npm run build` and `npm run start` automatically on every push to your repo's main branch. After the first deploy, run `npm run db:push` once against the production database to create the tables (Railway's project shell, or run it locally with `DATABASE_URL` temporarily pointed at production).
6. Once it's live, share the Railway URL with your family instead of `localhost`.

**Making future updates:** with this set up, updating the app is just `git add . && git commit -m "..." && git push` — Railway redeploys automatically. No more zip files.

## 3. Day-to-day use

- **Add a recipe**: Recipes → *Add a recipe* → choose **Paste a link**, **Upload a screenshot**, or **Enter by hand**. Imported fields are always editable before saving.
- **Meal Plan**: pick a week, click **+ Add** under any day/meal, search for a recipe.
- **Grocery List**: from the meal plan page, click *Build grocery list* for the current week, or go to Grocery List directly and pick any date range. Regenerating updates the auto-generated items but keeps anything you added by hand or already checked off.

## Notes & limitations

- Recipe import relies on the source site publishing [schema.org Recipe](https://schema.org/Recipe) structured data — the vast majority of cooking blogs and recipe sites do this (it's how they show up with photos/ratings in Google search results), but a few won't parse cleanly. Manual entry is always available as a fallback.
- Ingredient parsing into quantity/unit/item (used for the grocery list) is a best-effort heuristic, not a full NLP parser — it works well for typical American-recipe phrasing ("2 cups flour") but occasionally won't split unusual formats cleanly. You can always edit ingredient lines directly.
- Grocery list aggregation combines ingredients by matching item name text; it doesn't convert between units (e.g. it won't add "1 cup" + "8 oz" into one line), it just lists both quantities together.
- Images are loaded directly from their original source URLs (no re-hosting), so a recipe's photo will disappear if the source site takes the image down.

## Project structure

```
prisma/schema.prisma         Database schema
src/lib/recipe-extractor.ts  URL → structured recipe parsing (the import feature)
src/lib/ingredient-parser.ts Ingredient line → {quantity, unit, item}
src/lib/auth.ts               NextAuth (household-based login) config
src/app/api/                  All backend API routes
src/app/                      Pages (recipes, meal-plan, grocery-list, login, register)
src/components/               Shared UI (recipe form, recipe card, nav)
```
