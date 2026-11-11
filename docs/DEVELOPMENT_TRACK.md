# Omni Bible — development track (decision)

**Decided:** 2026-11-11 (Andre + Cursor plan implementation)  
**Supersedes:** ad-hoc “feature vs security” ambiguity after the ChatGPT review.

## Active track: **Hardening first (P0–P1), UI in parallel only when low-risk**

| Phase | Focus | Ship to production? |
|--------|--------|---------------------|
| **P0** | (1) **Done live:** revoke `exec_sql` from anon. (2) **PayFast deferred** — live webhook works; do not redeploy. (3) Profile subscription guard (partial; follow-up optional) | **Free mode ON** — paid signup hidden until Andre turns it back on |
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

## Next concrete tasks

1. ~~Migration: revoke `exec_sql`~~ — **live-verified** (anon denied).
2. **PayFast — do not change.** Andre confirmed the live notify URL works. Free mode is on. Revisit ITN hardening **only when paid subscriptions are turned back on.** Do not deploy git signature experiments.
3. Optional later: tighten profile INSERT/DELETE + overlapping RLS (not required for PayFast).

**Evidence labels:** **Confirmed live** = reproducer on production API. **Source only** = git risk not deployed.

## Andre override (2026-11-11)

Leave live PayFast as-is. App stays on **free mode** (`app_settings.free_mode`). Paid ITN hardening is deferred.
