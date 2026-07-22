# HumanFlow — AI Writing Platform

Full-stack AI writing platform: humanize AI-generated text, detect AI writing, check grammar, paraphrase, summarize, translate, generate citations, estimate plagiarism, and analyze readability/SEO — with accounts, word quotas, document history, projects, exports, and a public developer API.

Built with **Next.js 16 (App Router) + TypeScript**, **Prisma 7 + Neon Postgres**, and **Groq** for LLM inference.

## Features

- **Marketing site** — hero, features, interactive rewrite-mode picker, live editor demo, dashboard preview, pricing with comparison table, testimonials, FAQ, mobile menu
- **Auth** — email/password signup & login, bcrypt hashing, DB-backed 30-day sessions (httpOnly cookies), password reset and signup email verification via Resend
- **AI Humanizer** — 14 rewrite modes (Humanize, Academic, SEO, Friendly, …) via Groq, **streamed token-by-token** into the editor; post-rewrite Human/AI/Grammar/Plagiarism scores are real LLM-judged results, not placeholders
- **Rich document editor** (`/editor`) — Tiptap-based: upload PDF/DOCX/DOC/RTF/ODT/TXT/MD or images, manual editing with formatting toolbar, undo/redo, find & replace, drag-and-drop file insert, autosave, live statistics sidebar
- **AI editing in the editor** — run any operation on a selection or the whole document, **chain up to 6 operations** (scored once at the end), and review every change in a word-level **diff preview with accept / reject / partial accept**
- **Version control** — every AI operation snapshots the prior state; restore, compare (highlighted diff), rename, delete
- **Preserve-formatting mode** — AI-rewrites the text *inside* your original DOCX via in-place OOXML patching: styles, tables, images, headers, footers, and margins stay untouched (per-paragraph fidelity; intra-paragraph character formatting on edited paragraphs is the known trade-off)
- **OCR** — Tesseract-based, in-process: PNG/JPG/WEBP images and auto-detected scanned PDFs become editable text (per-plan page quotas)
- **File converter** (`/convert`) — PDF/DOCX/DOC/RTF/ODT/TXT/MD in → PDF/DOCX/TXT/MD out, no AI, no word credits (per-plan conversion quotas)
- **Batch processing** (`/batch`) — up to 5 files, one AI operation across all, download results as ZIP
- **Writing tools** (`/tools`) — AI Detector, Grammar Checker, Paraphraser, Summarizer, Translator (33 languages), Tone Changer, Citation Generator (APA/MLA/Chicago/Harvard), Plagiarism Checker, free Text Analyzer
- **Real computed metrics** — Flesch-Kincaid readability, keyword density, SEO score, word/char/sentence/paragraph counts, reading & speaking time
- **Workspace** — dashboard with usage meter, search (title/text/tags), document history, favorites, tags, projects, trash with restore, activity feed
- **Exports** — TXT, Markdown, DOCX, PDF (single documents and batch ZIP)
- **Plans & quotas** — words (Free 2k / Pro 100k / Enterprise unlimited), OCR pages, conversions, and storage bytes, all on a 30-day rolling reset
- **Developer API** — issue `hf_live_…` keys from the dashboard: `POST /api/v1/humanize`, `/api/v1/tools`, `/api/v1/analyze`, `/api/v1/convert`
- **Browser extension** (`browser-extension/`) — Chrome/Edge MV3 extension: humanize, rewrite, fix grammar, paraphrase, summarize, or translate selected text on any page via the popup or right-click menu, using your HumanFlow account
- **Word add-in** (`word-addin/`) — Office task-pane add-in that runs the same operations on a selection or the whole document from inside Microsoft Word
- **Help chatbot** — in-app assistant (streamed) that answers questions about the product, tools, pricing, and API
- **Copyleaks integration** — real plagiarism scans via signed webhooks once deployed to a public URL (`PUBLIC_BASE_URL`); LLM-based estimate on localhost
- **Rate limiting** — every expensive route is capped (Upstash Redis when configured, in-memory fallback otherwise)
- **SEO** — generated `sitemap.xml` and `robots.txt`
- **Scheduled cleanup** — a daily cron (`/api/cron/cleanup`, guarded by `CRON_SECRET`) purges documents left in the trash past a 30-day retention window (reclaiming their stored files and storage quota) and clears expired/used verification tokens; wired for Vercel Cron via `vercel.json`

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

Payments (Stripe), team collaboration, blog & legal pages. Enabling Next.js's `cacheComponents` flag for full static-shell caching of the marketing pages would need a dedicated audit — not done here.
