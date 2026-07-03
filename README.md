# HumanFlow — AI Writing Platform

Full-stack AI writing platform: humanize AI-generated text, detect AI writing, check grammar, paraphrase, summarize, translate, generate citations, estimate plagiarism, and analyze readability/SEO — with accounts, word quotas, document history, projects, exports, and a public developer API.

Built with **Next.js 16 (App Router) + TypeScript**, **Prisma 7 + Neon Postgres**, and **Groq** for LLM inference.

## Features

- **Marketing site** — hero, features, interactive rewrite-mode picker, live editor demo, dashboard preview, pricing with comparison table, testimonials, FAQ, mobile menu
- **Auth** — email/password signup & login, bcrypt hashing, DB-backed 30-day sessions (httpOnly cookies), password reset and signup email verification via Resend
- **AI Humanizer** — 14 rewrite modes (Humanize, Academic, SEO, Friendly, …) via Groq, **streamed token-by-token** into the editor; post-rewrite Human/AI/Grammar/Plagiarism scores are real LLM-judged results, not placeholders
- **Writing tools** (`/tools`) — AI Detector, Grammar Checker, Paraphraser, Summarizer, Translator (33 languages), Tone Changer, Citation Generator (APA/MLA/Chicago/Harvard), Plagiarism Checker, free Text Analyzer
- **Document upload** — paste text or upload a `.txt` / `.docx` / `.pdf` file, parsed server-side
- **Real computed metrics** — Flesch-Kincaid readability, keyword density, SEO score, word/char/sentence counts
- **Workspace** — dashboard with usage meter, document history with per-document pages, favorites, projects, activity feed
- **Exports** — TXT, DOCX, PDF
- **Plans & quotas** — Free (2,000 words/mo), Pro (100,000), Enterprise (unlimited), 30-day rolling reset
- **Developer API** — issue `hf_live_…` keys from the dashboard, then `POST /api/v1/humanize` with `Authorization: Bearer <key>`
- **Copyleaks integration** — real plagiarism scans via signed webhooks once deployed to a public URL (`PUBLIC_BASE_URL`); LLM-based estimate on localhost
- **Rate limiting** — login, signup, humanize, tools, and the public API are all capped (Upstash Redis when configured, in-memory fallback otherwise) to prevent brute-forcing and Groq-quota exhaustion

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, GROQ_API_KEY, …
npx prisma migrate dev # apply schema to your Postgres
npm run dev            # http://localhost:3000
```

Without a `GROQ_API_KEY` the app runs in mock mode — the full pipeline works, but rewrites use a rule-based fallback instead of a real model. Without `RESEND_API_KEY`, verification/reset emails are logged to the server console instead of sent. Without Upstash credentials, rate limiting falls back to an in-memory store (fine for one dev instance, not for multiple serverless instances).

## Environment

See [.env.example](.env.example) for every variable. Minimum to run: `DATABASE_URL`, `DIRECT_URL`. For real AI output: `GROQ_API_KEY`. For real plagiarism scans after deploying: `COPYLEAKS_EMAIL`, `COPYLEAKS_KEY`, `PUBLIC_BASE_URL`, `WEBHOOK_SECRET`. For transactional email: `RESEND_API_KEY`. For shared rate limiting across instances: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Testing

```bash
npm test              # fast unit tests (pure logic, no server/DB/API calls needed)
npm run dev &          # in another terminal
npm run test:integration  # real signup → humanize → quota flow against the live server + DB (uses real Groq calls if configured)
```

## API

```bash
curl -X POST https://your-host/api/v1/humanize \
  -H "Authorization: Bearer hf_live_..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Text to humanize", "mode": "Humanize"}'
```

Keys are created on the dashboard (`/dashboard` → API keys). Words consumed count against the account's monthly quota, and requests are rate-limited per key.

## Not yet implemented

Payments (Stripe), team collaboration, browser extension / Word add-in, blog & legal pages. Enabling Next.js's `cacheComponents` flag for full static-shell caching of the marketing pages would need a dedicated audit — not done here.
