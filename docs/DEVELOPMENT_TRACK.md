# Omni Bible — development track (decision)

**Decided:** 2026-11-11 (Andre + Cursor plan implementation)  
**Supersedes:** ad-hoc “feature vs security” ambiguity after the ChatGPT review.

## Active track: **Hardening first (P0–P1), UI in parallel only when low-risk**

| Phase | Focus | Ship to production? |
|--------|--------|---------------------|
| **P0** | PayFast signature + order validation; revoke/limit `exec_sql` (and any generic RPCs); export/fix `user_profiles` RLS so subscription fields are not owner-writable | **Block broad paid signup** until P0 proven in sandbox |
| **P1** | Real account deletion (or tracked request); blog/sermon HTML sanitization; server-side AI proxy + quotas | After P0 |
| **P2** | Migration, note labels, plan concurrency, reader request guard, PWA cache scope | After P1 |
| **Ongoing** | Search/plans **UI polish** (e.g. layout fixes) — OK **if** they do not touch PayFast, RLS, or subscription flows in the same deploy |

## Rationale

Live verify ([`LIVE_VERIFY_2026-11-11.md`](./LIVE_VERIFY_2026-11-11.md)) showed:

- `payfast-webhook` is **deployed**; repo code **does not verify** signatures before granting premium.
- **`exec_sql` is callable with the anon key** — worse than “SQL file in repo only.”

Side-income + real user data → **security and payments before new features**, but Andre can still ship **isolated UI improvements** (Search home, Read Today) without enabling new payment surfaces.

## What “staging-only payments” means here

- Keep **Subscribe / PayFast** flows for **admin testing and sandbox ITN** only until P0 is done.
- Do **not** market paid tiers publicly until acceptance checks in [`PROJECT_REVIEW_2026-11-11.md`](./PROJECT_REVIEW_2026-11-11.md) pass.

## Andre can override

To switch to **feature-first**, note it here with a date and accept payment/AI risk until hardening lands.

## Next concrete tasks (suggested order)

1. Fix and deploy `payfast-webhook` signature compare + replay/amount checks.
2. Migration: drop or restrict `exec_sql`; audit grants on `public` functions.
3. RLS/column protection on `user_profiles` subscription fields.
4. Smallest slice: Vitest for `subscription.js` + PayFast signature helper.
