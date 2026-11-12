# Auth setup — 2026-11-12

Repository: Andre6553/bible-app. Supabase: fikjnvkzhemamtlwsrin.

Existing email/password signup, login, reset and persistent Supabase sessions were reused.
The SettingsProvider remains the session source. No new auth package or providers.

## Changes

- Shared guard protects private study editing and admin routes. Waits for auth restore,
  checks admin profile ownership to reject stale profiles, and remembers the local URL.
- Public reader, search, study listing, sermon preview, profile, plans, subscription and
  legal pages retain their existing guest access and feature-level gates.
- Signup without a session now shows the email-confirmation message and does not migrate
  data or redirect as though signed in. Existing successful-login migration is retained.
- Password recovery also responds to Supabase's PASSWORD_RECOVERY event.
- Logout uses Supabase local signout, checks returned errors, and avoids reloading the
  old account through a stale callback. The existing user-change effect refreshes data.
- Live note_labels RLS no longer includes the permissive authenticated ALL policy.
  Read/delete requires note ownership or existing admin identity; writes also require
  ownership of the label or existing admin identity.
- Existing guard_user_profile_subscription_fields already blocks owner edits to paid
  and staff fields. A redundant trigger added during this work was removed in the next
  migration to preserve the trusted subscription RPC path. Both actual migration
  versions are checked into source for accurate replay.
- PayFast, pricing, free mode and subscription granting code were not changed.

## Verification

- 46 Vitest tests passed, including 11 new route/redirect checks, existing migration
  tests and 7 PayFast tests. Final production build and whitespace checks passed
  after the logout adjustment.
- Live rollback-only transaction under a fabricated authenticated JWT confirmed zero
  other-user note links visible and that an attempted admin profile insert is stripped
  to non-admin by the existing subscription guard. No test account was retained.
- Security advisors rerun. Remaining pre-existing notices include security-definer
  views, mutable function search paths, broad analytics/config reads, and disabled
  leaked-password protection. This task does not certify the entire app as secure.
  See https://supabase.com/dashboard/project/fikjnvkzhemamtlwsrin/advisors
  and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Browser smoke script intercepts all external calls and can check guest route redirects
  and unconfirmed signup without creating real accounts. Browser launch was blocked in
  this environment with both bundled Chromium and installed Chrome, so it has not passed.
  Run a local server on port 5184 then `node scripts/verify_auth_browser.js`.
- Real email delivery, confirmation/reset links, and a real user's cross-device session
  were not exercised. Auth provider settings and redirect allow-list were not changed.

## Delivery

Database migrations applied live; frontend changes remain local and require the usual
review/commit/push to deploy. Other edits appearing concurrently in the workspace were
left alone.
