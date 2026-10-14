# Project: Bible Study App

> Tier 2 of the Information Hierarchy. Read `../_ABOUT-ME/` first.

## What it is
A Bible study app (web/PWA) with topical reading plans. Aimed at being genuinely
helpful for study — friction-removing, in line with Andre's values.

## Stack & key paths
- App source in `src/`, built output in `dist/`, `landing-page/` for marketing.
- **Supabase** backend (`supabase/`, `migrations/`, `sql_imports/`).
- Bible text data in `Bible Versions/`.
- Play Store assets in `Google play store/` + `.google-play-creds` (Android release).
- Has its own `.cursor/` rules — follow them when editing.
- Secrets in `.env` (never print values).

## Status
Active, with a landing page and Play Store track in progress.

## Notes
- 2026-09-12: Groq deprecated `llama-3.1-8b-instant` (shutdown 2026-08-16). Default model
  moved to `openai/gpt-oss-20b` via `src/config/aiConfig.js`; Groq 404/empty-content fall back to Gemini.
  GPT-OSS requests use `include_reasoning:false`, `reasoning_effort:low`, `max_completion_tokens:4096`.
- _Add reading-plan ideas, store-listing notes, and "what worked" here._
