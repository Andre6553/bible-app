# Omni Bible — project review

**Repo copy:** [`Bible/docs/PROJECT_REVIEW_2026-11-11.md`](./PROJECT_REVIEW_2026-11-11.md) (archived 2026-11-11).  
**Live Supabase checks:** [`LIVE_VERIFY_2026-11-11.md`](./LIVE_VERIFY_2026-11-11.md).  
**Current dev track:** [`DEVELOPMENT_TRACK.md`](./DEVELOPMENT_TRACK.md).

Reviewed 11 November 2026. Scope: the local Bible repository, including application source, configuration, SQL scripts, offline storage, content-generation assets and deployment structure.

## Overall assessment

Omni Bible has substantial implemented functionality: a multilingual Bible reader, offline translations, exact and concept search, AI questions and study tools, sermons, reading plans, trivia, subscriptions and administration. The structure supports continued development without a rewrite. The immediate priority is securing paid/API access and making account and data operations dependable, before expanding the feature set.

This is a broad static review with focused examination of high-risk paths and isolated checks. It is not an exhaustive line-by-line review, a live penetration test or a production-readiness certification. Feature presence in source does not establish that every workflow works on a device.

## Evidence and limits

| Check | Result |
|---|---|
| JavaScript/React source scan | 72 non-backup files under `src`, 31,083 lines; all parsed successfully |
| Local static imports | No missing paths or missing named/default exports found in that source set |
| CSS | 26 non-backup CSS files under `src` |
| Installed top-level dependencies | `npm ls --depth=0 --offline` passed |
| Dependency vulnerabilities | `npm audit` failed because npm registry DNS resolution was unavailable; no clean vulnerability result is claimed |
| Automated test coverage | No conventional test/spec files found in the scanned repository outside excluded generated/dependency/backup folders; package scripts expose no test or lint command. Diagnostic scripts exist but were not run against live data |
| Local reading schedules | 30 plans, 1,086 days and 3,055 passages; no invalid book/chapter ranges, duplicate/out-of-range day numbers or catalog duration mismatches found |
| Isolated helper checks | Expired premium profile accepted by premium helper; blog formatter preserved an HTML event attribute |
| Git hygiene | No tracked `.env` variants other than examples, keystores or Google Play credential-directory paths found by filename check. This was not a full secret-content or git-history audit |
| Working tree | Existing changes to project notes, Cursor changelog rule and `changes Log` were present before review |

No production database queries, account actions, payment submissions, imports, cleanup scripts or deployments were performed. No production build was run, respecting the local rule requiring an explicit build request. No desktop/mobile visual or end-to-end validation was performed. Existing `dist` output was not treated as evidence of current source behavior. Dependency folders, backups, binary assets and XML corpora were not manually reviewed line by line.

## Architecture and implemented areas

| Area | Main files | Assessment |
|---|---|---|
| App and navigation | `src/App.jsx`, `BottomNav.jsx`, `BackButtonHandler.jsx` | Lazy route loading, an error boundary and mobile back handling are present |
| Bible reading | `BibleReader.jsx`, `bibleService.js` | Translation selection, split reading, chapter navigation, notes, highlights and reading-position sync are implemented |
| Offline reading | `offlineService.js`, `vite.config.js` | IndexedDB translation downloads, paginated verse fetching and a minimum-size check are present |
| Search and AI | `Search.jsx`, `aiService.js`, `aiConfig.js` | Keyword/concept search, conversations, history, reference resolution and provider fallback are implemented; security boundaries need work |
| Study content | `Study.jsx`, `InductiveEditor.jsx`, word-study services | Personal study tools are implemented; persistence depends on database authorization |
| Sermons | `SermonPrep.jsx`, `sermonService.js` | Outlining, content generation, research, PDF/preach overlays and speech tools are present; a large concentration of logic increases maintenance risk |
| Reading plans | `ReadingPlans.jsx`, `ReadingPlanDetail.jsx`, `readingPlanService.js` | Catalog, enrollment, day completion, notes, bilingual commentary and reader handoff are implemented |
| Daily content and trivia | `Blog.jsx`, `blogService.js`, `TriviaSection.jsx`, `triviaService.js` | Generated/cached articles and question workflows are implemented; HTML rendering needs protection |
| Accounts and settings | `Auth.jsx`, `Profile.jsx`, `SettingsContext.jsx` | Authentication, password-reset UI, preferences and profile operations exist; deletion is incomplete |
| Payments and administration | `SubscriptionPage.jsx`, `Admin.jsx`, PayFast edge function | Payment and admin flows exist; current local webhook must be hardened |
| Supporting content | `scripts/`, `Bible Versions/`, `landing-page/`, `Google play store/` | Content generation/import, marketing and distribution assets exist; they are separate from runtime feature validation |

The browser talks directly to Supabase for most data and directly to Gemini/Groq for AI. The PayFast edge function uses server-side Supabase service-role access. That division makes database policies and the edge function the important trust boundaries; UI gates alone cannot secure them.

## Priority findings

### 1. Critical if deployed: PayFast webhook does not authenticate completed payments

**Evidence:** `supabase/functions/payfast-webhook/index.ts:32-56` computes a signature hash but never compares it with the supplied signature. Lines 74-88 grant premium access from the submitted `payment_status` and `custom_str1`. `supabase/functions/config.toml` requests `verify_jwt = false`.

The handler requires a nonempty signature field, but its validity is not enforced. It also lacks expected-merchant/amount checks, a trusted order lookup and PayFast server validation. Thus this code does not establish that a completed payment is genuine before updating access. Actual exposure depends on which function/configuration is deployed; that was not verified.

**Recommended fix:** verify notifications according to PayFast's documented flow, resolve a server-created order, validate merchant and amount, and update payment/access records atomically. Add a unique provider transaction ID and replay handling. JWT-free gateway notifications can be valid architecture, but require gateway-specific verification.

### 2. High: AI provider keys and quota enforcement are in the browser

**Evidence:** `src/config/aiConfig.js:5-9`; direct SDK/fetch usage in `aiService.js`, `sermonService.js`, `blogService.js` and `triviaService.js`.

`VITE_GEMINI_API_KEY` and `VITE_GROQ_API_KEY` are client-exposed environment values when used by the frontend. Moving a secret into a Vite `.env` does not make it private in a shipped app. A visitor can inspect configured provider credentials and bypass application-level call limits. Provider restrictions may reduce impact but were not inspected.

`sermonService.js:290-354` also performs a browser-side read/check/increment and ignores the result of the usage update. Concurrent requests can lose increments. Guest usage checks do not provide a trusted identity boundary.

**Recommended fix:** move provider calls behind an authenticated backend, keep keys server-side, and enforce quotas with an atomic server-side reservation before calling the provider. Rotate existing exposed keys after migration and verify provider restrictions/budgets.

### 3. Critical verification priority: dangerous SQL helpers are present

**Evidence:** `src/sql_imports/install_exec_sql.sql:7-15` defines a `SECURITY DEFINER` function that executes arbitrary supplied SQL, with no in-function authorization or explicit execute revocation. `fix_missing_increment_rpc.sql:6-15` exposes an elevated function accepting arbitrary table/column identifiers to `anon` and `authenticated`.

Also, `fix_user_profiles_updated_at.sql:28-62` defines a subscription-changing elevated function without an admin check. Other SQL files define different signatures and authorization models. File presence does not prove any of these versions is installed. PostgreSQL/Supabase function execute defaults make explicit privilege inspection important.

**Recommended fix:** inspect installed function definitions and grants first. Remove or tightly restrict arbitrary SQL execution; replace generic mutation functions with narrow, validated operations. Audit overloads, explicit role checks, `search_path` and execute grants.

### 4. High, live state unverified: database policies are contradictory and profile privileges are mixed

**Evidence:** permissive policies appear in `highlights_notes_schema.sql`, `blog_schema.sql`, `enable_writes.sql` and several fixes. `src/sql_imports/supabase_diagnostics.sql:26-27` disables RLS on profiles/highlights. A later security script drops all public policies and rebuilds selected ones. Its profile policy at `supabase_security_audit.sql:76` grants row owners `FOR ALL` access without itself distinguishing editable preferences from subscription/admin fields.

Row ownership alone does not restrict which columns an owner can modify. If no separate column grants/trigger/backend restriction exists, subscription and admin fields may be editable by their owners. This is a conditional risk, not a confirmed live exploit. The global policy-reset script may also deny expected operations for tables whose policies it removes without recreating them.

**Recommended fix:** export current policies, grants, functions and protection triggers; verify account isolation and protected profile columns with separate test accounts. Consolidate approved changes into ordered migrations. Do not run the existing repair/audit scripts blindly.

### 5. High: Delete Account reports a request without submitting one

**Evidence:** `src/components/Profile.jsx:407-415` contains placeholder comments, calls `handleLogout()` and shows a message claiming the deletion request was received. No deletion or request submission occurs in that branch. `Legal.jsx` describes complete deletion via this button.

**Impact:** a user reasonably believes their account/data will be deleted, while this code has only signed them out.

**Recommended fix:** implement a server-authorized deletion or durable deletion-request workflow with explicit success/failure handling. Change the confirmation only after the server accepts the operation. Verify related data and retained payment/audit records deliberately.

### 6. High: blog content is inserted as unsanitized HTML

**Evidence:** `src/components/Blog.jsx:277-283` replaces markdown-style bold and newlines but does not escape or sanitize HTML; lines 486 and 637 pass the result to `dangerouslySetInnerHTML`.

An isolated formatter check confirmed an HTML event attribute survives unchanged. Browser execution was not tested. If hostile markup reaches stored/generated content, this creates an injection path in the app origin.

**Recommended fix:** render text/markdown through a safe React renderer or use a maintained HTML sanitizer with a narrow allowlist. Review sermon-generated HTML and `srcDoc` overlays too: the active overlay in `SermonPrep.jsx:3657` has no iframe sandbox, and interpolated titles require escaping.

### 7. Medium: expired premium records still satisfy the shared helper

**Evidence:** `src/utils/subscription.js:13-18` treats premium tier/override as sufficient independently of expiry. An isolated check with an expiry in 2000 returned `true`.

`SettingsContext.jsx:173-201` tries to downgrade expired profiles after loading, which partially mitigates the UI path, but does not make expiry validation intrinsic or server-enforced. The webhook writes both premium flags and expiry; AI services independently read profiles.

**Recommended fix:** define paid entitlement using expiry on the server, separate perpetual admin/tester privileges from time-limited paid status, and share matching display logic on the client.

### 8. Medium: anonymous-data migration can abandon unmigrated records

**Evidence:** `migrationService.js:72-75` reports uniqueness conflicts as success without implementing the described merge. Lines 111-113 remove the guest identifier when any table reports success. `checkIfMigrationNeeded` checks only four tables and can interpret read failures as no data.

**Impact:** partial migrations or guest data stored only in other tables may lose their retry/discovery identifier. Strict owner policies can also conflict with browser-driven reassignment of legacy guest records.

**Recommended fix:** keep the legacy identifier until verified completion, retain per-table progress, implement actual conflict resolution and move ownership transfer to a validated server workflow.

### 9. Medium: simultaneous plan updates can overwrite progress or notes

**Evidence:** `readingPlanService.js:296-337` reads and rewrites the entire `completed_days` array. Lines 482-513 read and rewrite the entire `day_notes` object without a version condition.

Two devices can read the same old value, make different changes and overwrite each other. Completion also lacks a local integer/range validation for the supplied day.

**Recommended fix:** use atomic database operations or per-day rows with unique keys; validate days server-side and preserve conflict information where needed.

### 10. Medium: note label removal and label-save failures are mishandled

**Evidence:** `highlightService.js:736-746` updates labels only when `labelIds.length > 0`. Removing every label therefore skips deletion of existing links. Delete/insert errors are not checked, and note + labels are saved separately.

**Recommended fix:** treat an empty label array as an intentional clear, distinguish omitted labels if necessary, check every result and save note/link changes atomically.

### 11. Medium: overlapping reader requests can display an old chapter

**Evidence:** `BibleReader.jsx:760-787` awaits chapter requests and applies results without a request identity/cancellation guard. Clearing old verses at request start does not prevent a slower earlier response from arriving later.

**Impact:** rapid chapter/version changes may show text from the earlier selection under a newer selection. This was identified by control-flow review; timing was not reproduced in a browser.

**Recommended fix:** use a latest-request token or cancellation guard for text, split view and associated metadata. `PlanDayReading.jsx` already demonstrates a cancellation flag for its own loader.

### 12. Medium: “all” lists and statistics need explicit pagination/aggregation

**Evidence:** `highlightService.js:316-326` and `778-798` fetch all highlights/notes without pagination. `adminService.js:224-239` derives distinct users and daily activity from unpaginated history. Some statistics fallbacks request `.limit(5000)` without paging.

These results depend on the server row cap; a large requested limit does not establish complete results. Offline verse downloads correctly use `.range()` and provide a useful existing pattern.

**Recommended fix:** paginate user collections; calculate aggregate statistics in narrowly authorized SQL functions/views. Make intentional search limits visible and distinguish truncation from a complete result.

### 13. Medium, needs device validation: authenticated caching is too broad

**Evidence:** `vite.config.js` applies one `NetworkFirst` cache route to all GET requests on the Supabase project host. Profile logout clears several component states but does not clear that API cache. Search/AI history also uses browser-global storage keys.

**Risk:** private responses or history may persist across sign-out/shared-device account changes. Cross-account disclosure was not reproduced and depends on request URLs, response headers and consumer behavior.

**Recommended fix:** cache public Bible content explicitly, exclude authenticated/private endpoints, namespace personal histories by account, and verify account-switch/logout behavior offline.

### 14. Medium: reading-plan structure is sound, but many study points have no explicit verse anchor

The local generated schedule data passed the structural checks described above. Of 9,205 English study-point objects in commentary sections, 7,795 have an empty/missing `verses` field (about 84.7%). `scripts/contentRules.js` produces generic fallback explanations that ask the reader to verify the statement.

An empty anchor does not prove a claim is inaccurate; references may also exist in other fields. However, it weakens the stated fact-first, verse-anchored content promise. The study text was not exhaustively fact-checked or compared word-for-word across languages.

**Recommended fix:** add editorial validation for important claims and language parity, identify template fallback content, and prioritize curated anchors for the most-used plans before increasing the catalog.

### 15. Lower priority: analytics setup and documentation have drifted

`index.html` initializes GA directly. `analyticsService.js` uses a different default ID but skips initialization when `window.gtag` already exists. This can leave events configured for the service's destination without consistently initializing it, while the HTML tag also enables its own default page view. Actual reporting impact was not inspected.

README sections say reading plans/audio-related features are future work despite current implementations, show both six and ten translations, and document port 5173 while Vite uses 3005. Its scores and competitor claims are self-descriptions, not independently validated evidence. Vercel currently rewrites every path to the app; the separate `landing-page/` directory is not explicitly configured as a separate deployment here.

**Recommended fix:** use one analytics initialization/configuration, document deployed behavior, and keep the public marketing site and app deployment intentions explicit.

### 16. Maintainability and release confidence need strengthening

The largest current modules are `SermonPrep.jsx` (3,664 lines), `Stats.jsx` (2,771), `Search.jsx` (2,456) and `BibleReader.jsx` (2,048). There are 135 SQL scripts in the scanned non-backup tree and 115 tracked paths matching backup naming. Runtime providers repeat similar AI request logic across several services.

This is development complexity rather than proof of broken functionality. It raises the cost of safe changes and makes policy/migration ordering harder to establish. No conventional automated regression suite was found.

**Recommended fix:** add a small set of meaningful tests for entitlements, notification rejection/replay, note labels, migration retries, plan concurrency and reader request ordering. Introduce linting and repeatable release checks. Extract shared provider access first; split large screens along coherent state/feature boundaries over time.

## Recommended work order

1. Verify live webhook version, database function grants and protected profile fields. Resolve any exposed critical paths before enabling paid access broadly.
2. Move AI keys/calls and quotas server-side; harden payment validation and entitlement expiry.
3. Implement real account deletion and sanitize rendered content.
4. Repair guest migration, note labels, plan concurrency and reader response ordering.
5. Restrict private caching, paginate complete collections and verify sign-out/account switching.
6. Add focused regression checks; validate desktop/mobile flows, offline reading and payment behavior in a controlled environment.
7. Improve reading-plan editorial anchors, analytics consistency, documentation and component structure.

## Suggested acceptance checks for the next implementation pass

- Forged, wrong-amount, unknown-order and replayed payment notifications cannot grant access.
- A normal signed-in user cannot change subscription/admin fields, read another user's notes or execute maintenance SQL.
- Client assets contain no paid AI provider secrets; server quotas hold under concurrent requests.
- Expired paid accounts lose paid access even if their profile flags have not been cleaned up.
- Account deletion either completes or creates a durable tracked request; failure never shows a success confirmation.
- Unsafe HTML is displayed harmlessly in blog and sermon views.
- Removing all labels clears links; injected link-save failure is reported accurately.
- Guest migration can retry after partial failure without losing the guest identifier.
- Two devices completing different plan days preserve both; note updates do not silently overwrite each other.
- Fast chapter changes always show the latest selected chapter; desktop/mobile and offline account-switch checks pass.

## Reference documentation

Official documentation consulted for platform/security behavior; local findings above come from this repository:

- Vite environment exposure: https://v5.vite.dev/guide/env-and-mode
- Supabase database function privileges and security modes: https://supabase.com/docs/guides/database/functions
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
- PayFast notification verification: https://developers.payfast.co.za/docs/itn-instant-transaction-notification/

This review changes no application code, configuration, database policy or production deployment.
