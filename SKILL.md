---
name: technical-writing
description: >
  Apply this skill for any formal technical document: reports, specs, briefs, proposals, SOPs, memos, white papers, or structured reference docs. Trigger whenever the user asks to write, format, or revise a professional document — especially if they want it structured, formal, or clear. Use this even for shorter docs like executive summaries or one-pagers when professional formatting matters.
---

# Technical Writing Style Guide

## Core Principles

- **Structure over prose.** Organize before you write. Hierarchy first.
- **One idea per bullet.** No compound thoughts. Split them.
- **Cut ruthlessly.** If a word doesn't carry weight, delete it.
- **Concrete over abstract.** Numbers, names, actions — not vague descriptors.
- **Never hedge.** State conclusions. If uncertain, say so once, then move on.

---

## Document Structure

Every formal document follows this skeleton:

```
1. Title / Header
2. Purpose (1–3 sentences max)
3. Body (sectioned, hierarchical)
4. Conclusion / Next Steps / Action Items
```

- Lead with the conclusion or recommendation, not the background.
- Background goes in a clearly labeled section — never in the opener.
- Use numbered sections for documents longer than one page.

---

## Formatting Rules

### Headings
- Use H1 for document title only.
- H2 for major sections. H3 for subsections. Stop at H3.
- Headings are nouns or noun phrases. Not sentences.
  - ✅ `System Requirements`
  - ❌ `This section describes the system requirements`

### Bullets
- Use bullets for lists of 3+ discrete items.
- Each bullet: one idea, one line (ideally).
- Start with a verb when listing actions. Start with a noun when listing things.
- No periods at end of bullets unless they're full sentences.
- Nested bullets: max two levels deep.

### Indentation & Hierarchy
- Indent sub-points exactly one level under their parent.
- Sibling bullets = same level of abstraction. Don't mix levels.
- Use whitespace aggressively. Dense text = unread text.

### Tables
- Use tables for comparisons, options, or multi-attribute data.
- Every table needs a title row.
- Keep cells short. Move long explanations to footnotes or bullets.

### Bold / Emphasis
- Bold key terms on first use, critical warnings, and action owners.
- Italics for titles or technical terms only.
- Do not bold for decoration.

---

## Language Rules

| Avoid | Use instead |
|-------|-------------|
| "It is important to note that..." | State the thing. |
| "In order to" | "To" |
| "Due to the fact that" | "Because" |
| "Leverage" (as a verb) | "Use" |
| "Utilize" | "Use" |
| "Facilitate" | "Enable" / "Help" |
| Passive voice | Active voice |
| Adverbs | Stronger verbs |

- Write sentences under 20 words when possible.
- Prefer short paragraphs (2–4 sentences) over long ones.
- Technical terms: define once, use consistently. Never swap synonyms.

---

## Tone

- Formal but not stiff.
- Direct. Say what you mean.
- No apologies, hedges, or filler phrases.
- Don't editorialize unless in an explicitly labeled "Recommendation" section.

---

## Common Document Types

### Specification / Requirements Doc
- Sections: Overview → Scope → Requirements → Constraints → Open Questions
- Number all requirements: `REQ-001`, `REQ-002`, etc.
- Each requirement: one sentence, measurable, testable.

### Executive Brief / Summary
- Max 1 page.
- Structure: Situation → Problem → Recommendation → Impact
- No jargon. No technical detail in the brief — link to supporting docs.

### Report
- Structure: Summary → Findings → Analysis → Recommendations
- Summary = full picture in 5 bullets or fewer.
- Findings = factual, no interpretation.
- Analysis = interpretation only.
- Recommendations = numbered, owned, time-bound.

### SOP / Process Doc
- Each step: numbered, verb-first, one action.
- Decision points: use a table or labeled branch (`If X → go to Step 4`).
- Include: Owner, Trigger, Frequency, Output.

---

## What Not to Do

- Don't write an intro that explains what you're about to say. Say it.
- Don't bury the recommendation in paragraph 4.
- Don't use 10 words when 3 work.
- Don't mix formatting styles mid-document.
- Don't leave action items without owners or deadlines.
