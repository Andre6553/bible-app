# Project: Omni Bible (Bible)

> Tier 2 of the Information Hierarchy. Read `../_ABOUT-ME/` first.

## What it is

**Omni Bible** — Bible study and sermon-prep **PWA** (React + Vite). Reading, highlights/notes,
exact + concept search, AI Bible Search (Gemini), sermon preparation, stats, reading plans,
trivia, blog, subscriptions. Brand: **Omni Bible**; live site linked from `README.md`.

## Stack & key paths

| Item | Detail |
|------|--------|
| **GitHub** | [Andre6553/bible-app](https://github.com/Andre6553/bible-app) |
| **Hosting** | Vercel (`vercel.json` SPA rewrites) — production URL in `README.md` |
| **Frontend** | React 18, React Router, Vite 5, PWA (`vite-plugin-pwa`) |
| **Backend** | Supabase (`@supabase/supabase-js`) — client-side; project ref **`fikjnvkzhemamtlwsrin`** |
| **AI** | Google Gemini (`@google/generative-ai`) — search, sermon, quotas in app |
| **Analytics** | Vercel Analytics |

**Paths (this folder):**

- `docs/` — audit and process: [`PROJECT_REVIEW_2026-11-11.md`](docs/PROJECT_REVIEW_2026-11-11.md), [`LIVE_VERIFY_2026-11-11.md`](docs/LIVE_VERIFY_2026-11-11.md), [`DEVELOPMENT_TRACK.md`](docs/DEVELOPMENT_TRACK.md)
- `src/` — app source (`components/`, `services/`, `context/`, etc.)
- `public/` — static assets, PWA manifest, themes
- `scripts/` — reading-plan generators, Supabase upserts (`upsert_reading_plans_remote.js`); live audit probe [`live_verify_readonly.js`](scripts/live_verify_readonly.js)
- `changes Log` — plain-English **user-facing changelog** (maintained each ship; see rule below)
- `.cursor/rules/` — project rules (`responsive-design.mdc`, `changes-log.mdc`, …)
- `.env` — local secrets (see `C:\Users\User\.secrets\` README); **`.env.example`** for variable names only

**Run locally:**

```text
npm install
npm run dev      # Vite, --host 0.0.0.0
npm run build    # production build
npm run preview
```

**Supabase / DB work**

- Use Bible **`.env`** (`VITE_SUPABASE_URL`, service role for scripts).
- **Not** the BizTap Supabase MCP project (`user-supabase` / `vsujfqufdyoxfaopqcut`).
- Reading-plan remote upsert: `node scripts/upsert_reading_plans_remote.js` (see `scripts/PLAN_CURATION.md`).

## Status

**Active** (Andre, 2026-11-11). **Free mode ON**. PayFast ITN webhook deployed (signature + order fulfill). `exec_sql` revoked from anon. Checkout: **first month intro promo** (card list → 50%, PayFast **min R5** so cards show). Do not charge full list on first-month checkout. 2026-11-11: `omnibible@gmail.com` ITN miss — manual 30-day grant; webhook raw-body ITN.

## Notes

- **2026-11-11:** Andre: leave live PayFast (`…/functions/v1/payfast-webhook`) unchanged; free mode stays on. Git webhook restored to match that live handler (do not deploy signature experiments).
- **2026-11-11:** ChatGPT review archived under `docs/`; **live verify** then **`exec_sql` revoked from anon**. Details: [`docs/LIVE_VERIFY_2026-11-11.md`](docs/LIVE_VERIFY_2026-11-11.md).
- **2026-11-11:** `changes Log` + `.cursor/rules/changes-log.mdc` — log user-visible changes; one
  git push per ship when possible (avoid double Vercel builds).
- **2026-11-11:** Plan **Read Today** — `plan-reading-active` body class, top back bar, bottom
  next/complete (`BibleReader.jsx` / `BibleReader.css`).
- **2026-11-11:** Search launcher — full-screen keyword + AI modals; home is card/button launcher
  (`Search.jsx`, `Search.css`).
- **Play Store / PWA:** assets and notes under `Google play store/`, `public/`.
- **Backups / imports:** `Bible Versions/` (XML corpus), `backup_before_versions/` — reference;
  not day-to-day edit targets unless importing text.

_Add deployment URLs, subscription/PayFast state, and schema migration paths here as they change._
