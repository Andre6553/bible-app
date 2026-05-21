# Plan Intelligence — Learning User Study Habits

Omni Bible learns **what each reader cares about** from behavior over time, then **suggests** reading plans — without locking users in a filter bubble.

## Design principles

1. **Learn from actions, not guesses** — enrollments, completions, views, searches, AI questions, Bible reading patterns.
2. **Blend, never solely personalize** — recommendations mix personal fit, editorial quality, and discovery.
3. **Transparent** — UI labels explain *why* a plan appears (“Based on your interest in peace”, “Explore something new”).
4. **Privacy** — profile is per-user, stored in Supabase; guests get editorial + discovery only.
5. **Human curation wins** — `PLAN_CURATION.md` topics always ship; intelligence **ranks and surfaces**, it does not replace editors.

---

## Blend formula (default)

| Source | Weight | Purpose |
|--------|--------|---------|
| **Personal** | 40% | Match learned intent/category scores |
| **Editorial** | 30% | Curated sort order, weekly slate, quality plans |
| **Discovery** | 30% | Categories/intents user rarely explores |

Adjust weights in `planIntelligenceService.js` (`BLEND_WEIGHTS`).

---

## Signals tracked

| Event | Weight | What it teaches |
|-------|--------|-----------------|
| `plan_enrolled` | High | User chose this topic/category |
| `plan_day_complete` | Medium | Sustained interest |
| `plan_viewed` | Low | Curiosity (detail page) |
| `plan_completed` | High | Strong affinity for topic |
| `plan_paused` | Neutral | Life interruption, not dislike |
| `plan_abandoned` | Small negative | Topic or length may not fit |
| Search logs | Medium | Topics they look up |
| AI questions | Medium | Deeper questions they ask |
| Enrollment history | Bootstrap | Cold-start before events accumulate |

---

## User profile shape (`user_plan_profiles.profile`)

```json
{
  "intent_scores": { "faith": 12, "peace": 8, "family": 3 },
  "category_scores": { "topic": 10, "devotional": 6 },
  "duration_affinity": { "short": 2, "medium": 5, "long": 1 },
  "plans_started": 4,
  "plans_completed": 1,
  "top_intents": ["faith", "peace"],
  "recent_events": [],
  "search_synced_at": "2026-05-21T12:00:00Z",
  "version": 1
}
```

**Intent keys** align with `planTopics.js` (`READER_INTENT_POOL`) and search topic maps.

---

## Cold start (new user)

1. Show **editorial** picks (sort order / featured).
2. Add **discovery** variety (mixed categories).
3. After first enrollment or 3 plan views, personal weight ramps up gradually (`personalWeightMultiplier` in service).

---

## Phase 2 — AI summary (optional)

When enough events exist (e.g. 10+), optionally call Gemini to produce a **short study persona** paragraph stored in `profile.ai_summary` — used for admin insight and future copy, **not** as sole ranking input.

Rule-based scores always remain the primary ranker; AI narrates the profile.

---

## Phase 3 — Weekly catalog

When `published_week` exists on plans, editorial slot prefers **this week’s 7** before global sort order.

---

## Files

- `src/services/planIntelligenceService.js` — events, profile, recommendations
- `src/sql_imports/plan_intelligence_schema.sql` — optional dedicated tables
- `scripts/planTopics.js` — intent taxonomy
- `scripts/PLAN_CURATION.md` — human topic quality

---

## Inactivity

Plan intelligence **does not** pause or delete enrollments. Inactivity only affects streak display. Profile persists until user deletes account.
