# Omni Bible — live verification (read-only)

**Date:** 2026-11-11  
**Supabase project:** `fikjnvkzhemamtlwsrin` (`https://fikjnvkzhemamtlwsrin.supabase.co`)  
**Method:** Service role + anon key checks from local `Bible/.env` only. No schema writes, no payment tests, no user data exported.

## Summary

**Prioritization (P0 order):** Items **confirmed live** on the Bible API (anon can call `exec_sql`) fix **before** items **confirmed in source only** (PayFast signature bypass in git; deployed edge not diffed). **`user_profiles` subscription RLS** is third — important after closing arbitrary SQL and forged ITN.

| Check | Result |
|--------|--------|
| Correct Supabase host | Confirmed via `VITE_SUPABASE_URL` |
| `payfast-webhook` edge function deployed | Endpoint responds (`OPTIONS` 200 on `/functions/v1/payfast-webhook`) |
| PayFast signature enforced in **git** source | **No** — hash computed and logged only; premium granted on `COMPLETE` ([`supabase/functions/payfast-webhook/index.ts`](../supabase/functions/payfast-webhook/index.ts) lines 52–88). Deployed code not diffed against dashboard; assume matches repo until dashboard proves otherwise. |
| `verify_jwt` for webhook | **false** in [`supabase/functions/config.toml`](../supabase/functions/config.toml) (expected for PayFast ITN; requires strong signature validation). |
| `exec_sql` RPC | **Present and callable** with **service role** and with **anon key** (both returned success on harmless `SELECT 1`). **Critical:** arbitrary SQL execution is available to unauthenticated clients if grants match this test. |
| `increment(text,…)` RPC (repo concern) | **Not found** in live API schema cache (function name/signature may differ or be absent). |
| `reading_plans` (catalog) | 56 rows visible to service role |
| `user_profiles` | 27 rows visible to service role (count only; no PII pulled) |

## PayFast webhook (repo vs live)

- **Live:** Function URL is active on the Bible project.
- **Repo:** Signature comparison is explicitly bypassed for “local testing”; handler still upgrades `user_profiles` when `payment_status === 'COMPLETE'`.
- **Action:** Treat paid access as **unsafe** until deployed code enforces PayFast ITN signature (+ amount/merchant/replay checks). Re-deploy after fix and retest with PayFast sandbox ITN.

## Database / RLS / RPC

- **`exec_sql`:** Confirmed callable via PostgREST from **anon** — aligns with review finding #3 at severity **critical on production**.
- **Full policy export:** Not completed in this pass (PostgREST cannot read ad-hoc audit views without schema reload). Next step: run a controlled SQL export in Supabase SQL Editor (read-only queries on `pg_policies`, `pg_class.relrowsecurity`) or add a `returns json` audit RPC via a reviewed migration.
- **BizTap MCP:** Cursor `user-supabase` points at `vsujfqufdyoxfaopqcut` — **not** this database. Bible work must use `Bible/.env` or Bible-specific tooling only.

## Helper script

[`scripts/live_verify_readonly.js`](../scripts/live_verify_readonly.js) — intended for catalog snapshots; PostgREST schema cache blocked reading temp views. Use the ad-hoc checks above or extend with a proper `SECURITY DEFINER` read-only audit function in a future migration.

## Re-run

```text
cd Bible
node scripts/live_verify_readonly.js   # partial / may need SQL Editor follow-up
```

Or repeat anon/service `exec_sql` probe only in a throwaway Node one-liner (do not log keys).

## Post-P0 migration (same day)

| Check | Result |
|--------|--------|
| `exec_sql` via **anon** | **Denied** (`permission denied for function exec_sql`) |
| `exec_sql` via **service_role** | Still works (maintainer scripts) |
| `user_profiles` subscription trigger | Applied (`guard_user_profile_subscription_fields`) |
| Live RLS export | [`RLS_POLICIES_EXPORT_LATEST.json`](./RLS_POLICIES_EXPORT_LATEST.json) |
| PayFast webhook **deployed** code | **ITN hardening deployed** 2026-11-11 (Bible token). Forged ITN returns 400. Secrets `PAYFAST_PASSPHRASE` + `PAYFAST_MERCHANT_ID` set. |
