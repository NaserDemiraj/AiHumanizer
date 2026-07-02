# HumanFlow — AI Writing Platform

Full-stack AI writing platform: humanize AI-generated text, detect AI writing, check grammar, paraphrase, summarize, translate, generate citations, estimate plagiarism, and analyze readability/SEO — with accounts, word quotas, document history, projects, exports, and a public developer API.

Built with **Next.js 16 (App Router) + TypeScript**, **Prisma 7 + Neon Postgres**, and **Groq** for LLM inference.

## Features

- **Marketing site** — hero, features, interactive rewrite-mode picker, live editor demo, dashboard preview, pricing with comparison table, testimonials, FAQ, mobile menu
- **Auth** — email/password signup & login, bcrypt hashing, DB-backed 30-day sessions (httpOnly cookies)
- **AI Humanizer** — 14 rewrite modes (Humanize, Academic, SEO, Friendly, …) via Groq
- **Writing tools** (`/tools`) — AI Detector, Grammar Checker, Paraphraser, Summarizer, Translator (33 languages), Tone Changer, Citation Generator (APA/MLA/Chicago/Harvard), Plagiarism Checker, free Text Analyzer
- **Real computed metrics** — Flesch-Kincaid readability, keyword density, SEO score, word/char/sentence counts
- **Workspace** — dashboard with usage meter, document history with per-document pages, favorites, projects, activity feed
- **Exports** — TXT, DOCX, PDF
- **Plans & quotas** — Free (2,000 words/mo), Pro (100,000), Enterprise (unlimited), 30-day rolling reset
- **Developer API** — issue `hf_live_…` keys from the dashboard, then `POST /api/v1/humanize` with `Authorization: Bearer <key>`
- **Copyleaks integration** — real plagiarism scans via webhooks once deployed to a public URL (`PUBLIC_BASE_URL`); LLM-based estimate on localhost

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, GROQ_API_KEY, …
npx prisma migrate dev # apply schema to your Postgres
npm run dev            # http://localhost:3000
```

Without a `GROQ_API_KEY` the app runs in mock mode — the full pipeline works, but rewrites use a rule-based fallback instead of a real model.

## Environment

See [.env.example](.env.example) for every variable. Minimum to run: `DATABASE_URL`, `DIRECT_URL`. For real AI output: `GROQ_API_KEY`. For real plagiarism scans after deploying: `COPYLEAKS_EMAIL`, `COPYLEAKS_KEY`, `PUBLIC_BASE_URL`.

## API

```bash
curl -X POST https://your-host/api/v1/humanize \
  -H "Authorization: Bearer hf_live_..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Text to humanize", "mode": "Humanize"}'
```

Keys are created on the dashboard (`/dashboard` → API keys). Words consumed count against the account's monthly quota.

## Not yet implemented

Payments (Stripe), team collaboration, browser extension / Word add-in, blog & legal pages. Human/AI scores in the humanize flow are estimates; the AI Detector tool gives the real LLM-judged verdict.
