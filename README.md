# Stock Analyzer

A Next.js stock and market analysis dashboard: live quotes, multi-year price
history with Bollinger bands, return distribution, analyst targets, insider and
institutional flow, seasonality, computed financial-health scores, and three
strategy backtests. Korean (KOSPI/KOSDAQ) tickers are supported alongside US
listings.

## Requirements

- Node 22 or newer
- No API key is required to run the app

## Getting started

```bash
npm install
cp .env.example .env.local   # optional; see Environment below
npm run dev
```

Then open http://localhost:3000.

## Environment

The app works with **no environment variables at all**. Prices, charts, risk
scores, news and symbol search all come from Yahoo Finance and CNN.

A key is only needed for two optional panels — the bull/bear thesis and the
social-discussion list — and both fall back gracefully without one.

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | No | Google Gemini. Used if set. |
| `ANTHROPIC_API_KEY` | No | Anthropic Claude. Used if Gemini is not set. |
| `AI_PROVIDER` | No | Force `gemini` or `claude`. Otherwise auto-selects. |
| `GEMINI_MODEL` | No | Pin one Gemini model instead of the default fallback chain. |

> **Never prefix these with `NEXT_PUBLIC_`.** That inlines the value into the
> browser bundle and publishes your key.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run check` | Typecheck, lint and test — what CI runs |
| `npm test` / `npm run test:watch` | Vitest |

## Architecture

```
app/api/               thin route handlers: validate, delegate, map errors
lib/calc/              pure functions — series, distribution, simulations,
                       Altman Z and Piotroski F. No React, fully unit tested.
lib/server/yahoo/      one fetcher per upstream call
lib/server/stock/      symbol resolution + the payload assembler (no I/O)
lib/server/ai/         provider-agnostic AI behind one interface
lib/server/cache/      the only place "use cache" appears
components/dashboard/  layout shell, panels and charts
hooks/                 data fetching and memoized analytics
```

Two conventions worth knowing:

**Financial scores are computed, never generated.** Altman Z-Score and
Piotroski F-Score are closed-form formulas over the balance sheet and income
statement. They are calculated in `lib/calc/scores.ts` and return `null` rather
than a misleading number when Yahoo's coverage is too sparse.

**Caching is per fetcher, not per response.** Quotes go stale in minutes while
fiscal-year statements do not move for months, so each upstream call carries
its own lifetime (`lib/server/cache/profiles.ts`). A 1-year and a 5-year
request for the same symbol share one fundamentals entry.

## Testing

```bash
npm test
```

Vitest runs two projects: `lib/**` and the route handlers in Node, components
and hooks in jsdom. Every network seam is mocked, so the suite needs no API key
and no connectivity.

## Deploying to Vercel

1. Push to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new). The
   framework preset and build command are detected automatically.
3. Optionally add `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) under Settings →
   Environment Variables for Production and Preview.
4. Deploy.

This app cannot be hosted on GitHub Pages: static export cannot run the API
routes under `app/api`, which is where all the data fetching lives.
