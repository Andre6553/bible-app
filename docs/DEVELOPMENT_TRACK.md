# Omni Bible — development track (decision)

**Decided:** 2026-11-11 (Andre + Cursor plan implementation)  
**Supersedes:** ad-hoc “feature vs security” ambiguity after the ChatGPT review.

## Active track: **Hardening first (P0–P1), UI in parallel only when low-risk**

| Phase | Focus | Ship to production? |
|--------|--------|---------------------|
| **P0** | (1) Revoke/limit `exec_sql` (and audit generic RPCs); (2) PayFast signature + ITN validation; (3) protect `user_profiles` subscription fields (trigger + policy export) | **Block broad paid signup** until P0 proven in sandbox |
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

## Next concrete tasks (order = live evidence)

1. Migration: revoke `exec_sql` from `anon`/`authenticated`; re-probe with anon key (must fail).
2. Fix and deploy `payfast-webhook` signature compare + merchant/amount/replay checks; PayFast sandbox ITN.
3. Export live policies; `user_profiles` subscription trigger (owners cannot self-elevate); align `subscription.js` with server truth.
4. Smallest slice: Vitest for `subscription.js` + PayFast signature helper.

**Evidence labels:** **Confirmed live** = reproducer on production API (e.g. anon `exec_sql`). **Source only** = risk visible in git but not fully diffed to deployed edge/SQL until you verify.
