# Sahi Khabar — सही ख़बर

Fact-based news aggregator with receipts. No newsroom, no editor, no tracking —
software fetches stories from real outlets (India + world), Reddit, and Hacker
News every 2 hours, groups articles about the same event, and computes a
transparent **confidence score** for every story:

| Component | Weight |
|---|---|
| Corroboration — independent outlets covering the story | 40 |
| Source reliability — hand-maintained ratings in `config/sources.ts` | 30 |
| Primary source — links to official documents/statements | 15 |
| Headline check — clickbait/sensationalism (Claude Haiku or heuristics) | 15 |

Plus an **Under the Radar** feed: high community engagement, low mainstream
coverage.

## Architecture

Static site rebuilt on a schedule — zero servers, zero databases, ~$0/month.

```
GitHub Actions (cron, every 2h)
  pnpm ingest   fetch RSS + Reddit + HN -> cluster -> score -> data/stories.json
  pnpm build    Next.js static export -> out/
  deploy        prebuilt upload to Netlify (data branch keeps 7-day state)
```

- `config/sources.ts` — all sources + reliability ratings (the editorial policy)
- `pipeline/` — fetchers, clustering (TF-IDF + optional Haiku tie-breaks), scoring
- `app/`, `components/` — Next.js 15 + Tailwind v4 frontend
- `data/stories.json` — the entire "database"

## Develop

```sh
pnpm install
pnpm ingest      # pulls live news (works without any API keys)
pnpm dev
```

Optional env vars: `ANTHROPIC_API_KEY` (smarter clustering + headline checks),
`REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` (real vote counts).

Deployment: see [SETUP.md](./SETUP.md).
