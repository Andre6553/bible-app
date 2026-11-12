# Cursor handoff — reliability corrections, 12 November 2026

## Outcome and scope

Changes are in the canonical Bible repository. PayFast files and the free_mode setting were not changed.
Earlier Cursor work (commit c25a0c4) was retained. This pass adds a new migration rather than rewriting the already-applied 090000 migration.

**Deployment status:** SQL `20261112100000_reliability_corrections.sql` **applied live** 2026-11-12 via `node scripts/apply_reliability_corrections.js --apply` (preflight succeeded). Deletion edge functions and cron still require Dashboard deployment and a dedicated-account E2E. Do not describe account-deletion cleanup as live until that is done.

## 1. Legacy guest ownership and concurrency

- New migration: supabase/migrations/20261112100000_reliability_corrections.sql.
- Adds legacy_guest_migration_claims: guest_id is unique, user_id references the destination Auth account. Public/anon/authenticated cannot read or write approvals. service_role may manage them.
- Both inspect_guest_migration and migrate_guest_data now require a matching verified claim through _require_guest_claim.
- A guest ID pattern, localStorage value or account login is NOT ownership proof. There is no automatic first-claim-wins endpoint.
- Legacy transfer now requires a maintainer to independently verify ownership and record a verification reference. Do not auto-create approvals from a browser-supplied ID. If existing legacy ownership cannot be established, retain the data and do not transfer it.
- This intentionally prevents unverified legacy auto-migration. A new anonymous-auth/secure guest credential system is separate future work; this change does not retrofit proof that was never stored.
- Advisory locks now serialize by guest identity and destination account, instead of by the account/guest pair. Approval rows and existing source/destination notes and plans are also locked.
- src/services/migrationService.js checks the actual session account, refuses overlapping transfers for different accounts, validates every expected table in inspections, and will not clear a different guest ID created during a pending request.
- src/components/Profile.jsx explains that legacy data was retained and support verification is needed (English/Afrikaans).

### Authorising a legacy mapping

Use a trusted maintainer/service-role path ONLY after independent verification. Insert guest_id, verified destination Auth user UUID, and an auditable verification_reference into legacy_guest_migration_claims. Never infer these from an arbitrary supplied ID alone. A unique guest_id prevents approval to two accounts. After approval, the user's normal Sync action performs the transfer. No approvals were created in this session.

## 2. Preserve study relationships and conflicts

- In the new migrate_guest_data definition, remap guest verse_notes.study_id BEFORE deleting a duplicate study collection (the old ON DELETE SET NULL order lost the reference).
- Adds guest_migration_conflicts, with owner-only SELECT and service-role maintenance. Before deleting merged or destination-wins rows, save the complete source row transactionally.
- Snapshots cover conflicting studies, labels, notes, highlights, categories, word studies, plans, plan profiles and settings. Original differing content remains recoverable instead of being silently discarded.
- No automatic archive expiry was added. The deletion cleanup includes these snapshots. There is no new archive browser UI; support can assist with recovery, or the owner can read their records under RLS.

## 3. Deletion worker and schema-aware cleanup

- supabase/functions/_shared/deletionProcessor.js contains the actual orchestration used by the worker and regression tests.
- supabase/functions/process-account-deletions/index.ts claims one job immediately before processing (up to five per invocation) rather than allowing a batch of waiting jobs to consume their leases. Stops after a failed job so it does not immediately reclaim the same pending request.
- purge_account_deletion_data scopes cleanup by claimed job ID and claimed_at, not an arbitrary user ID. Requires a current lease and locks the job.
- note_labels is removed through owned verse_notes and user_labels. It is never filtered by a nonexistent user_id column.
- The allowlist of user tables is cleaned and counted in one transaction. A genuine missing optional table is detected via to_regclass; missing columns, FK failures and leftover rows raise errors and roll the cleanup back.
- Auth is NOT deleted when the first relational cleanup fails. Renew the lease, delete Auth, purge again to catch writes made before Auth removal, then finish the request.
- Completion/retry RPCs compare the claim timestamp and active lease. A stale worker cannot update a newer claim's status. Failed retry-status persistence is reported.
- Only a specific missing-Auth-user error is accepted for retries; generic 404 / unrelated not-found errors do not imply a deleted user.
- Cleanup includes new archive/claim tables and user_trivia_daily. This remains an explicit allowlist, not a blanket claim that every future table or storage object is handled. Confirm retention requirements and any additional user-data tables before production E2E.
- These RPCs are service-role only. Deletion still requires both edge functions, CRON_SECRET, scheduling and a dedicated-account E2E. Do not deploy the new worker before the new SQL.

## 4. Database-derived AI allowance

- Replaces reserve_ai_usage(integer) in the new migration. Keeps the old parameter for older clients but ignores it; DEFAULT NULL allows new clients to call with {}.
- Locks the account profile and derives the limit from stored free_mode, profile override/tier and expiry: tester 500, admin/premium/free-mode 999999, otherwise 50, matching the current client policy.
- src/services/aiUsageService.js no longer sends a caller-selected cap for signed-in reservations.
- Existing increment_ai_usage wrapper delegates to the same server policy; its old 999999 argument no longer chooses the cap.
- No app setting was changed. Browser AI provider keys, mutable profile permissions and the separate guest usage path still require their own hardening; this is not a server proxy.

## Tests and limits

Ran npm test -- --exclude src/utils/payfastItn.test.js: 29 tests passed across three files. PayFast was excluded.

New tests execute the actual migration service and shared deletion processor against mocked Supabase responses, including failed inspection, missing approval, incomplete inspection, merge failure, failed verification, changed guest identity, account changes, overlapping requests, cleanup failure, lost leases, post-Auth failure and retry-status failure.

Parsed 85 source files plus the TypeScript worker successfully. These are source/orchestration checks, NOT proof of SQL compilation, PostgreSQL concurrency or deployed E2E behaviour. No local PostgreSQL/Docker executable was available. No production build or visual browser check was run in this pass; the UI change is an alert message.

## Apply and verify

1. Review and apply the new migration AFTER 20261112090000 on Bible project fikjnvkzhemamtlwsrin. scripts/apply_reliability_corrections.js reads Bible/.env, validates the exact host, performs a read-only preflight and exits nonzero on failure. Use --apply to submit the single migration via exec_sql. Do not print credentials. A client timeout leaves application status uncertain; inspect the database before retrying.
2. Verify unauthorised guest/account pairs cannot inspect or migrate; test two accounts claiming the same guest; confirm unverified clients retain their local identifier.
3. With a deliberately verified guest fixture, test conflicting note text, duplicate studies and preserved study links, label links, archived differing word-study analysis, plus rollback on an injected failure. Verify source/destination edits from a second session.
4. With two DB sessions, test quota reservations at the limit and verify that a huge supplied p_limit cannot change the server cap. Test free_mode/expiry/tester behaviour without changing the production free_mode setting.
5. Deploy ONLY request-account-deletion and process-account-deletions after SQL. Keep PayFast unchanged. Configure cron/CRON_SECRET and check worker JWT settings.
6. Use a dedicated disposable account to verify complete cleanup, Auth removal, error retries and expired-lease recovery. Never use a real customer as a test fixture.

Git push status will be reported separately in ChatGPT. Read git status/log before continuing; the user authorised a push for this work.
