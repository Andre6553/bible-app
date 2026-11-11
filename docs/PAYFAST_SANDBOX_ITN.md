# PayFast ITN hardening (no sandbox)

**Notify URL (unchanged):**  
`https://fikjnvkzhemamtlwsrin.supabase.co/functions/v1/payfast-webhook`

SQL + git are in place. **The live edge function is not replaced until you set secrets and deploy.**

## Secrets (Supabase Dashboard → Edge Functions → Secrets)

- `PAYFAST_PASSPHRASE` — salt passphrase from PayFast merchant settings (required)
- `PAYFAST_MERCHANT_ID` — production merchant id (`11945617`)
- Optional: `PAYFAST_VALIDATE_HOST` — default `www.payfast.co.za`

Then deploy (from a folder **without** a broken root `.env` if the CLI fails to parse it):

```text
npx supabase login
npx supabase functions deploy payfast-webhook --workdir <copy of supabase/> --remote=fikjnvkzhemamtlwsrin --yes
```

## Test without sandbox (free mode stays on)

1. Keep free mode ON so other users do not see Subscribe.
2. Temporarily turn free mode off **only for your login test**, or call PayFast from a private build.
3. Pay **once** with your own card to the live merchant.
4. Confirm your profile is premium. If not, redeploy the previous webhook and grant that user in Stats.

Do not POST forged COMPLETE payloads at real user ids.
