# Reading Plan Commentary — Content Rules

All study commentary in reading plans MUST follow these rules.

## 1. Bible facts first

- **Summary:** Only state what the chapter **records** — events, speech, commands, outcomes.
- **No invented details:** Do not add characters, quotes, motives, or timelines not in the text.
- **Verse anchors:** Key points must reference verse numbers from that chapter where possible (e.g. `v. 3`, `vv. 26–27`).

## 2. Content types (never mix without labeling)

| Type | Label in UI | Allowed content |
|------|-------------|-----------------|
| **Fact** | Summary / key points | What the passage says happened or was said |
| **Teaching** | "What God wants us to know" | What the passage teaches about God and us — must cite **why** from verses in this chapter |
| **Cross-reference** | "Similar elsewhere" | Parallel passages with factual comparison |
| **Reflection** | "Reflection questions" | Personal application — never stated as narrative fact |

Teaching sections state an insight drawn from the chapter and a **Why?** paragraph that points back to specific verses or recorded speech. Avoid speculation beyond what the text supports.

## 3. Cross-references ("Similar elsewhere")

When another part of Scripture uses similar language, themes, or parallel events:

- Cite **book chapter:verse** (matching app book IDs / standard abbreviations).
- State what **each passage records** and how they **align or contrast** — no speculation.
- Prefer: repeated phrases, parallel narratives (e.g. creation, covenant, exile), law quotations, Gospel parallels.

## 4. Bilingual parity

Afrikaans and English must convey the **same facts and references**. Do not add unique claims in one language.

## 5. Auto-generated fallback

Template commentary for chapters without curated notes must:

- Stay descriptive in summaries; use category-based teaching templates that tell the reader **what to look for in the text**
- Include at least one same-book or category cross-reference when data exists
- Always include a teaching + why block (category fallback if not curated)

## 6. Source of truth

The in-app **verse text** (Supabase `verses` table) is authoritative. Commentary must not contradict the selected Bible version's wording.

## 7. Inspirational tone (without breaking facts)

Commentary should feel **alive and relevant** while staying factual:

- **Summaries:** Clear, vivid description of what the text records — help the reader *see* the scene or argument.
- **Teaching:** Connect the passage to real human experiences (fear, guilt, hope, waiting) only as an **entry point**, then ground every claim in verses from the chapter.
- **Cross-references:** Show how Scripture echoes itself — this is inherently encouraging when done accurately.
- **Reflection questions:** Invite honest engagement; never imply the Bible guarantees specific outcomes (health, wealth, instant peace).

Topic choice, plan descriptions, and weekly curation are defined in [PLAN_CURATION.md](./PLAN_CURATION.md).  
**Topics are human-chosen for reader need; commentary is fact-checked against the text.**
