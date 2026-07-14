# Setting up Sahi Khabar

One-time steps to take the site from "runs on my laptop" to "auto-updates on the
internet every 2 hours". Total cost: **$0 fixed + ~$2–5/month of Anthropic API**
(and even that is optional — without a key the pipeline falls back to free
heuristics).

## 0. Run locally (already works)

```sh
export PATH="$HOME/.local/node22/bin:$PATH"   # Node 22 installed for this project
pnpm install
pnpm ingest        # fetches live news -> data/stories.json
pnpm dev           # http://localhost:3000
```

## 1. Create the private GitHub repo and push

```sh
cd sahi-khabar
git add -A && git commit -m "Sahi Khabar v0.1"
# with GitHub CLI:
gh repo create sahi-khabar --private --source=. --push
# or create it on github.com and:
git remote add origin git@github.com:<you>/sahi-khabar.git
git push -u origin main
```

> The scheduled workflow runs every 2 hours ≈ 700–1,000 minutes/month, inside
> the 2,000 free Actions minutes for private repos. Check usage under
> Settings → Billing after the first week.

## 2. Create the Netlify site

```sh
npx netlify-cli login
npx netlify-cli sites:create --name sahi-khabar   # or any free name
```

Note the **Site ID** it prints (also on the site's dashboard under
Site configuration → General). Then create a personal access token at
https://app.netlify.com/user/applications#personal-access-tokens.

## 3. Add GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value | Required? |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | the personal access token from step 2 | yes |
| `NETLIFY_SITE_ID` | the Site ID from step 2 | yes |
| `ANTHROPIC_API_KEY` | from https://console.anthropic.com → API keys | recommended (~$2–5/mo; enables smarter story grouping + headline checks) |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | create a free **script** app at https://www.reddit.com/prefs/apps | optional (adds real vote counts; without it Reddit is read via RSS) |

## 4. First deploy

Repo → Actions → "Ingest news and deploy" → **Run workflow**. When it goes
green, the site is live on your Netlify URL. After that it refreshes itself
every 2 hours; pushing to `main` also redeploys.

## Maintenance notes

- **Add/remove/re-rate sources:** edit `config/sources.ts` — that file is the
  whole editorial policy.
- **Feed breaks:** the run log prints `FAIL <source>` per broken feed; a broken
  feed never blocks the others, and the site keeps serving the last good data.
- **Cost control:** the only paid piece is the Anthropic key. Usage is capped by
  design (batched calls, `claude-haiku-4-5`, max ~150 pair-checks per run).
  Remove the secret and the pipeline silently drops to heuristics-only.
