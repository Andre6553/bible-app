# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Omni Bible is a React 18 + Vite client-side SPA (PWA) for Bible study and sermon preparation. It connects to a remote Supabase instance (PostgreSQL + Auth) and uses the Gemini AI API for AI features. There is no backend to run locally — only the Vite dev server.

### Running the dev server

```bash
npm run dev
```

The server starts on **port 3005** (configured in `vite.config.js`). It binds to `0.0.0.0` so it is accessible from all interfaces.

### Building

```bash
npm run build
```

Outputs to `dist/`. The build includes PWA service worker generation via `vite-plugin-pwa`.

### Lint / Test

There is no ESLint, Prettier, or test framework configured in this project. No `lint` or `test` scripts exist in `package.json`.

### Key gotchas

- **Supabase credentials have hardcoded fallbacks** in `src/config/supabaseClient.js`, so the app starts without a `.env` file. AI features require `VITE_GEMINI_API_KEY` to be set.
- **No `.nvmrc` or `engines` field** — Node 18+ is required per the README. The current VM has Node 22 which works fine.
- **PWA is disabled in dev mode** (`devOptions.enabled: false` in `vite.config.js`), so service worker caching won't interfere during development.
- The `open: true` option in the Vite server config will attempt to open a browser on start; this is harmless in headless environments.
