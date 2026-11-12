# For You changes implemented locally — Cursor deployment handoff

12 November 2026. Andre asked ChatGPT to implement the For You plan and leave plain-English deployment instructions for Cursor.

## Plain-English message from Andre

The For You code changes are ready in my local Bible folder. Please read this handoff, apply the new For You database script first, check the screen on phone and desktop, run the tests/build, and then commit/push/deploy the verified changes. Leave PayFast and free mode unchanged. Tell me when the new For You screen is actually live.

## Current status — do not confuse this with a production release

- Implementation is in canonical local files under Bible. No commit, push or deployment was performed for this task.
- The new SQL has NOT been submitted or verified on PostgreSQL in this session.
- Supabase plugin discovery reports it installed/enabled, but this running ChatGPT session has no exposed Supabase project/SQL actions. No credential or network retry was attempted after agreeing Cursor would handle network work.
- There is other uncommitted authentication work in this same checkout. Preserve it; do not reset/clean or overwrite App.jsx, Auth.jsx, Profile.jsx, ProtectedRoute files or auth migrations. Review/stage the intended work deliberately.
- No PayFast files, free_mode values, login/migration behaviour or subscription policy were changed by this task.

## What changed for users

1. For You now plans one reflection and two different article styles together. Formats include passage explanation, biblical people, a thoughtful question, textual/literary context, practical discipleship and quiet reflection.
2. Style affects the whole structure and ending, rather than swapping a topic inside the same motivational template. Prayers/questions are no longer forced onto every article.
3. Topic preferences are shared by the reflection and both articles. Excluded topics stay out of selection. Users can choose Prefer, Exclude or Automatic; failed saves restore the prior choice.
4. Recent activity is weighted by age, repeated signals are capped, bilingual topic phrases share canonical identities, and recent topics/formats influence rotation.
5. English/Afrikaans and the three content slots have independent caches. A local-day devotional stays stable until an intentional replacement or preference update. One article's refresh no longer updates another piece's timestamp.
6. Each piece normally requests title, summary and body in one model response: three provider requests for a fully cold successful three-piece feed, rather than six. Validation may repair once; provider fallback may add requests. No live cost/sample measurement was made.
7. A primary passage is fetched from the Bible corpus before generation. English currently uses KJV; Afrikaans tries AFR53 then AFR83. There is no silent English quotation fallback for Afrikaans.
8. The exact retrieved verse text is rendered separately from the reflection. Additional verse citations in model commentary are rejected rather than displayed as verified references. Reader links preserve the existing reader translation behaviour; they do not silently change the user's selected Bible version.
9. Generated prose is rendered as React text nodes, without dangerouslySetInnerHTML. Literal malicious markup cannot execute in this component.
10. Sections settle independently; a slow article does not hide a ready reflection. Failed regeneration keeps the previous eligible piece. Account/language request guards discard stale UI results.
11. Save, Helpful, Already read and Less like this are persisted separately. Saving/generating does not count as reading. Less like this downranks recent similar topics/formats without permanently excluding the topic.
12. Saved pieces can be reopened across days/languages. Nonfunctional view counters and the misleading Trending section were removed. Interests are in an expandable section.
13. The existing active reading plan is linked through the existing /plans/:slug route, without changing plan logic.
14. A previous legacy devotional can be used as a clearly labelled fallback if new content is not ready. Original user_devotionals and old preference records are not deleted. Old article caches are deliberately not imported because their shared language marker was unreliable.

## Files belonging to this implementation

### Existing files changed

- src/components/Blog.jsx — For You page rewritten around the dedicated service; progressive sections, interest editing, saved reading, feedback, safe text rendering, modal Back/Escape/focus behaviour and account/language guards.
- src/components/Blog.css — new styles use the fy- prefix; existing legacy selectors retained to avoid global styling regressions. Responsive rules for narrow/wide screens and safe areas.
- src/services/blogService.js — only generateBlogAiText and getAiModelLabel are newly exported for reuse. Existing admin/provider settings and legacy functions are retained. The new screen no longer calls the old selection/cache functions.
- src/services/bibleService.js — small pre-existing compile fix in getUserHistory: destructure rawBibleReadings, then use a mutable bibleReadings local for its existing book-name mapping. The previous code reassigned a const and prevented dependency bundling. No intended history behaviour change.
- PROJECT.md / changes Log — new pending-deployment notes from this task, preserving existing auth notes.

### New files

- src/config/forYouFormats.js — six format briefs, labels, endings and editorial version.
- src/config/forYouTopics.js — bilingual topic catalogue, book interests and canonical passage coordinates. Quoted verse text is not hardcoded here.
- src/utils/forYouSelection.js — deterministic planner, timezone date keys, interest matching/weighting, legacy preference normalisation and model response validation.
- src/services/forYouService.js — dedicated context, preferences, generation leases, structured generation, corpus lookup, safe cache handling and feedback/saved-reading persistence.
- src/utils/forYouSelection.test.js / src/services/forYouService.test.js — 28 new tests of the actual planner/service paths with mocked network/provider responses.
- supabase/migrations/20261112160000_for_you_v2.sql — additive For You database setup.
- scripts/verify_for_you_schema.sql — read-only catalogue/privilege assertions after migration.
- scripts/verify_for_you_ui.mjs — isolated real-component UI harness with fixture services; no live account/AI data.
- This handoff. The longer original brief remains CURSOR_FOR_YOU_IMPROVEMENT_PLAN_2026-11-12.md.

## Database design and required apply order

The migration creates ONLY dedicated For You objects:

| Object | Purpose |
|---|---|
| for_you_preferences | Owner preferences, legacy keyword preferences imported lazily and non-destructively, optimistic version checks |
| for_you_content | Generated pieces, independently keyed by owner/local day/language/slot/generation |
| for_you_slots | Current cached piece plus a three-minute generation lease per slot |
| for_you_feedback | Independent saved/helpful/read/less_like flags |
| for_you_get_preferences / for_you_patch_preferences | Owner-scoped initialisation and checked updates |
| for_you_claim_content / for_you_complete_content / for_you_release_content | Atomic work claims and token-checked cache persistence |
| for_you_set_feedback | Owner-checked field updates |

All new tables have RLS, with owner SELECT. Clients mutate through authenticated RPCs deriving the owner from auth.uid(), never a supplied user ID. Auth-user foreign keys cascade, so the new tables participate in Auth deletion without editing the existing deletion worker. No database transaction is held open during a provider call.

The server keeps the existing For You refresh-policy inputs: blog_rate_limit_enabled, explicit super users and premium/free-mode benefits. It does not change any of those settings or introduce a new shared AI quota. Provider keys remain browser-side as before; this work is not the separate AI server-proxy/security project.

### 1. Apply the migration before shipping the frontend

From C:\Users\User\Ai Projects\Bible, using the working Cursor execution environment:

```powershell
node scripts/run_sql.js supabase/migrations/20261112160000_for_you_v2.sql
node scripts/run_sql.js scripts/verify_for_you_schema.sql
```

Use Bible/.env and confirm project fikjnvkzhemamtlwsrin. Do not print secrets. The existing run_sql.js logs errors but may still exit zero, so read its actual execution result. A zero process exit alone is NOT verification. The migration should be submitted as one exec_sql call and must finish successfully before frontend deployment. Do not blindly rerun after an ambiguous timeout; inspect the new objects first. CREATE POLICY is not intended as a repeated migration runner.

### 2. Verify real database behaviour with disposable accounts

- Account A cannot SELECT B's rows or update B's content/feedback through RPCs.
- Anonymous clients cannot execute mutation RPCs.
- Two sessions requesting the same account/day/language/slot receive one active claim. A released/expired lease can be claimed again; a stale token cannot complete a newer claim.
- Preference patches with an old version fail without losing another tab's updates.
- Confirm the composite-returning functions' response shape. The client accepts both object and one-row-array responses.
- English and Afrikaans have separate slots. Refreshing one slot leaves other generated_at timestamps untouched.
- Verify local-day rollover against the intended timezone.
- Auth deletion of a disposable account cascades new For You content, slots, preferences and feedback.

### 3. Run local checks and inspect the screen

```powershell
npm test -- --exclude src/utils/payfastItn.test.js
node scripts/verify_for_you_ui.mjs
```

After Andre's build authorisation, run npm run build before deployment. It was not run here because the project rule requires a build request. An in-memory dependency bundle was verified instead.

The UI harness bundles the actual Blog component with fixture APIs and checks English/Afrikaans at 375px and 1280px, touch-control dimensions, horizontal overflow, modal fit and Escape. It writes temporary fixture screenshots, not real user data. The harness could not launch Chrome here (TargetCloseError); therefore do not claim visual checks passed. Run it from Cursor's working environment and inspect the screenshots. Adjust long Afrikaans labels if needed.

Also check real Android Back, keyboard focus, safe-area spacing, modal scrolling and saved-reading actions manually. The fixture harness does not establish actual Android behaviour or production networking.

### 4. Do a small real-generation editorial smoke test

Use a disposable normal account and, if needed, the existing admin account without changing free mode. Generate one feed in each language and read the pieces consecutively. Check:

- Article formats and endings sound different from each other and from the reflection.
- Excluded topics do not reappear as primary suggestions, including discovery.
- A single preferred topic still offers differing passages/formats.
- Literal verse text matches the displayed version in the corpus.
- No invented historical background, personal circumstances or guaranteed outcomes appear.
- Afrikaans sounds natural. Format metadata/person names in prompts do not leak as English prose.
- A normal successful cold feed uses about three provider calls; cache hits use none. Measure retries/fallbacks separately.
- Switching en -> af -> en reuses the original English cache, and delayed responses never overwrite the current language/account.
- Provider/cache/preference failures leave previous content/choices intact and do not falsely report success.
- Save -> reopen -> unsave works across a reload. Feedback changes one flag without clearing other flags.
- Less like this affects later selections but does not permanently ban an entire topic.

### 5. Commit/push/deploy the reviewed work

Preserve other pending auth work in this checkout. Do not git reset/clean or stage unrelated files automatically. Confirm the intended changes, then commit/push using Cursor's working Git environment. Keep SQL-before-frontend order. There is no new edge function to deploy for For You.

Rollback is straightforward: revert the For You frontend changes if necessary; leave additive tables in place for inspection/recovery rather than deleting users' new saved content. Old cache/preferences tables were not removed.

## Verification actually completed here

- 67 non-PayFast tests passed across six files, including 28 new For You tests and existing reliability/auth tests.
- All 94 current JS/JSX source files parsed successfully.
- Real For You dependency graph bundled in memory with esbuild; no production build files were written.
- git diff --check passed.
- No live provider request was made for this task.
- SQL compilation, actual PostgreSQL concurrency/RLS and live end-to-end generation remain unverified.
- Browser fixture execution was attempted but failed at Chrome launch, before layout assertions.

Do not report this as deployed or fully production-verified until the above steps are complete. Give Andre a plain-English result with what is live, what passed, and anything still outstanding.
