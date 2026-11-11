# PayFast sandbox ITN test (after signature fix)

Prerequisites:

- Edge function deployed: `payfast-webhook`
- Supabase secrets: `PAYFAST_PASSPHRASE` (must match PayFast dashboard), optional `PAYFAST_MERCHANT_ID`, optional `PAYFAST_MIN_AMOUNT_ZAR` (default `1`)

## Sandbox checkout

In `SubscriptionPage.jsx`, set `USE_SANDBOX = true` locally only for ITN tests (do not ship to production).

## Verify deployed handler

1. Complete a sandbox payment with `custom_str1` = a test user id.
2. In Supabase → Edge Functions → `payfast-webhook` logs: expect `Invalid signature` for forged posts only; valid ITN should grant premium once per `pf_payment_id`.
3. Repeat the same `pf_payment_id` payload: response `{ duplicate: true }`, profile unchanged.

## Manual forged ITN (must fail)

POST `application/x-www-form-urlencoded` to  
`https://fikjnvkzhemamtlwsrin.supabase.co/functions/v1/payfast-webhook`  
with `payment_status=COMPLETE` and a fake `signature` → **400 Invalid signature**.
