# Reading Plan Curation — Inspirational, Informative Topics

This document defines **what plans we publish** and **why readers will care**.  
Technical accuracy rules live in [CONTENT_RULES.md](./CONTENT_RULES.md). This guide covers **topic intelligence**, tone, and weekly selection.

---

## Editorial promise

Every plan must help a reader answer:

1. **Why should I care about this?** (human need, curiosity, life season)
2. **What will I understand when I finish?** (clear learning outcome)
3. **How does Scripture speak to that?** (passages chosen on purpose, not random chapters)

Plans are **inspirational** because they connect real life to what God has revealed.  
Plans are **informative** because they teach what the text **records and teaches** — with verse anchors, not vague devotion.

---

## The three layers of every plan

| Layer | Purpose | Example |
|-------|---------|---------|
| **Hook** (title + description) | Speaks to a desire, fear, or question | *"When You Feel Forgotten by God — 14 Days"* |
| **Journey** (daily titles + passages) | Builds understanding step by step | Day 1: Elijah under the broom tree → Day 14: God’s faithful presence |
| **Study** (commentary blocks) | Facts + teaching + cross-refs + reflection | Summary of what happened; what God wants us to know; why (from verses) |

If the hook is strong but passages are random, the plan fails.  
If commentary is accurate but the topic is dull, readers won’t start.

---

## Topic selection — choose with intelligence

### Start from reader intent, not from “available chapters”

Pick topics from **what people actually ask** when they open a Bible app:

| Reader need | Example questions | Plan angle |
|-------------|-------------------|------------|
| **Suffering & pain** | Why does God allow this? Where is He? | Lament psalms, Job, Jesus’ passion, Paul’s trials |
| **Anxiety & fear** | How do I stop worrying? | “Do not fear” passages *in context*, Philippians 4, Psalms of trust |
| **Identity & worth** | Who am I in Christ? | Creation, adoption, image of God, Ephesians 1–2 |
| **Relationships** | Marriage, parenting, conflict, forgiveness | Proverbs, Ephesians 5–6, Joseph, Ruth, Philemon |
| **Purpose & calling** | What is God’s will for my life? | Jonah, Moses, Esther, Acts, Romans 12 |
| **Sin & forgiveness** | Can I be forgiven? How do I change? | Psalm 51, prodigal son, 1 John, Romans 3–8 |
| **Hope & end times** | What happens after death? Is there hope? | Resurrection accounts, 1 Thessalonians 4, Revelation 21–22 |
| **Knowing Jesus** | Who is Christ really? | Gospel portraits, Colossians 1, Philippians 2 |
| **Prayer** | How should I pray? Does God hear? | Lord’s Prayer, Hannah, Daniel, Jesus in Gethsemane |
| **Wisdom for daily life** | Work, money, speech, decisions | Proverbs themes, James, Sermon on the Mount |
| **Beginners** | Where do I start? What is the big story? | Creation → Exodus → Gospels → Acts (short arcs) |
| **Seasonal / church calendar** | Advent, Easter, Pentecost | Themed 7–14 day arcs (not generic “Christmas verses”) |

**Afrikaans readers:** Same needs; titles and study guides must feel natural in AF, not translated clichés.

### Topic quality gates (must pass all before publish)

- [ ] **Named outcome:** “After 14 days you will understand how Scripture defines faith vs. fear.”
- [ ] **Honest scope:** Title doesn’t promise what the passages don’t address.
- [ ] **Progression:** Early days build foundation; later days deepen or apply (not 14 random comfort verses).
- [ ] **Variety of genre:** Mix narrative, poetry, epistle, Gospel where possible — not 14 psalms unless the plan is explicitly “Psalms of …”.
- [ ] **Avoid proof-texting:** No plan that strings unrelated one-liners without chapter context.
- [ ] **Dual audience:** Works for new readers *and* rewards someone who’s read the Bible for years.
- [ ] **Bilingual parity:** Same emotional and intellectual promise in EN and AF.

### Reject or redesign

| Weak pattern | Why | Fix |
|--------------|-----|-----|
| “Random verses about X” | Feels like a search result, not a journey | Curate 10–21 days with a narrative arc |
| “Read whole book fast” with no study angle | Informative but not inspirational | Add study guide: *why this book matters now* |
| Trendy topic with thin Scripture | Clickbait | Narrow the promise or add passages |
| Duplicate of existing plan | Catalog fatigue | Change angle (e.g. “Faith in Exile” vs “Faith and Hope”) |
| Only OT or only NT for life-topic plans | Imbalanced theology | Include cross-testament echo where theme allows |

---

## Weekly drop: 7 plans with intentional mix

When publishing **7 plans per week**, don’t pick 7 similar themes. Use a **balanced slate**:

| Slot | Role | Example topics |
|------|------|----------------|
| 1 | **Life issue** (broad appeal) | Peace in anxiety, grief, forgiveness |
| 2 | **Know Jesus / Gospel** | Miracles that reveal identity, “I AM” sayings, cross & resurrection |
| 3 | **Character study** | David, Ruth, Mary, Peter’s failure and restoration |
| 4 | **Book or letter spotlight** | Jonah in 4 days, Jude, Philemon, Lamentations |
| 5 | **Practical wisdom** | Money & contentment, speech & tongue, work & rest |
| 6 | **Family / community** | Raising faith at home, one-another commands, unity |
| 7 | **Seasonal or cultural moment** | Easter prep, harvest thanks, new year renewal, exam stress |

Rotate slots so week 2 doesn’t repeat week 1’s “anxiety plan” with a new title.

See `planTopics.js` for pools, rotation, and validation helpers.

---

## Writing inspirational + informative copy

### Plan description (catalog card)

**Formula:** `[Reader situation].` + `[What this plan does].` + `[What you’ll gain].`

**Good (EN):**  
*“When life feels unstable, it’s hard to trust God’s promises. Over 14 days, walk through passages where biblical figures faced fear — and what Scripture records about God’s character in those moments. You’ll learn what the text actually says about trust, not just comforting slogans.”*

**Weak:**  
*“A great plan about faith. Read Bible verses every day.”*

### Study guide (plan intro block)

- 2–4 sentences: **why this topic matters now**
- One sentence: **how days are organized**
- Invite study, not guilt: *“Take one day at a time; notes are saved as you go.”*

### Day titles

- Specific and human: *“When Elijah Wanted to Die”* not *“1 Kings 19”*
- Subtitle in passage list still shows book/chapter for clarity

### Commentary tone (within CONTENT_RULES)

| Do | Don’t |
|----|--------|
| Show what the passage **records** vividly | Invent dialogue or motives |
| Name the **tension** readers feel (fear, shame, waiting) | Preach beyond what verses support |
| Teaching: **what God reveals** about Himself | Generic “God loves you” without verse-linked why |
| Cross-refs: **parallel stories** that deepen understanding | Random verse dumps |
| Reflection: **honest questions** | False certainty about God’s will for their job/marriage |

**Inspirational ≠ fictional.** Inspiration comes from **truth well explained**, not from made-up illustrations passed off as Scripture.

---

## Curated vs generated plans

| Type | When to use | Standard |
|------|-------------|----------|
| **Curated JSON** (`curated_plans/`) | Themed plans, weekly slots 1–3 & 5–6 | Hand-picked passage order + day titles; full commentary pipeline |
| **Schedule-generated** | Whole-book / NT / OT tracks | Strong study guide + category fallbacks; mark as `catalog_tier: core` |
| **Weekly new** | 7/week expansion | At least **2 fully curated** per week; rest may use smart templates **if** topic arc is hand-designed |

**Rule:** Auto-generated commentary can support a plan; **auto-generated topics cannot**. The topic arc is always human-chosen.

---

## Catalog growth (never delete)

- Old plans stay available in **Library**; new plans appear in **This Week**.
- Tag `published_week` for weekly drops; evergreen plans use `catalog_tier: core`.
- Finished user enrollments move to **Archive**; they can review or restart (see product design for weekly + archive).

---

## Pre-publish checklist (editor + script)

1. Topic passes quality gates above  
2. `PLAN_CURATION.md` outcome written in plan meta  
3. EN/AF titles and descriptions reviewed by fluent speaker  
4. Passages verified in `books` / `verses` tables  
5. Commentary generated; spot-check 3 random days for facts + teaching + cross-refs  
6. No duplicate slug; `published_week` set for weekly plans  
7. Seed upsert run; smoke test in app (expand day 1, scroll, version switch)

---

## Related files

- [CONTENT_RULES.md](./CONTENT_RULES.md) — factual commentary policy  
- [planTopics.js](./planTopics.js) — topic pools, weekly slot templates, validation  
- [PLAN_INTELLIGENCE.md](./PLAN_INTELLIGENCE.md) — behavior learning and blended recommendations  
- [planCommentary.js](./planCommentary.js) — study guide and day intro generation  
- [curated_plans/](./curated_plans/) — hand-built passage lists  
