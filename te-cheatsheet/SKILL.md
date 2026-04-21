---
name: te-cheatsheet
description: Build print-ready 2–3 page PDF cheatsheets in the Teenage Engineering website visual style. Use this skill whenever the user wants a cheatsheet, quick reference, or condensed guide for any Teenage Engineering product (Pocket Operators, EP series, OP series, etc.), or when they want to convert a TE product guide URL into a PDF reference card. Also use it when the user asks to fix blank pages or layout issues in an existing TE cheatsheet.
---

# Teenage Engineering Cheatsheet Skill

Creates dense, print-ready PDF cheatsheets from TE product guides, matching the visual style of teenage.engineering.

## Workflow

1. **Fetch guide content** — use WebFetch with multiple targeted prompts to extract all functionality, controls, parameters, and visual style from the guide URL
2. **Build the HTML** — apply the CSS layout rules below exactly
3. **Generate the PDF** — use Chrome headless
4. **Count pages** — if blank or mostly-empty pages appear, see "Fixing blank pages" below

---

## Layout Rules (Critical — Read Carefully)

### The three CSS approaches and why two of them fail in Chrome print

**`display: grid` — NEVER use for page-spanning layouts**
Chrome treats grid rows as atomic units. `break-inside: avoid` on grid items causes entire rows to be pushed to new pages, leaving large blank gaps. Forced `page-break-after` then fires again after overflow → blank pages.

**`column-count` — NEVER use**
Chrome's multicol print engine creates one physical "page-column slot" per column. When `break-inside: avoid` prevents balancing, some column slots are left empty. Each empty column slot renders as a blank page. With `column-count: 4` this can produce 4 blank pages for every 1 content page.

**`display: inline-block` — ALWAYS use**
Inline-block columns with explicit percentage widths are the only reliable multi-column approach in Chrome print. Each column is an independent vertical flow. `break-inside: avoid` on section cards works correctly. Empty space at the bottom of a short column is just empty space — not a blank page.

### Correct column layout — use flexbox

`inline-block` columns with `font-size: 0` on the parent (the common whitespace-gap fix) causes overlapping text in Chrome's print engine with nested content. Use `display: flex` instead — no whitespace gap, no overlapping text, no blank pages.

```css
.col-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;  /* columns don't stretch to equal height */
  width: 100%;
}
/* flex values control relative widths */
.c25 { flex: 1;    min-width: 0; }  /* ~25% of row */
.c33 { flex: 1.33; min-width: 0; }  /* ~33% of row */
.c50 { flex: 2;    min-width: 0; }  /* ~50% — double-wide for long content */
```

`min-width: 0` prevents flex items from overflowing when content is wide.

Sections inside columns:
```css
.section {
  display: block;
  width: 100%;
  margin-bottom: 8px;
  break-inside: avoid;
  page-break-inside: avoid;
  /* NO overflow:hidden — clips text */
}
```

### Page structure — headers only at top of pages

Wrap each logical page in a `.page` div. Put `break-before: page` on page 2's wrapper — not on a header inside the content flow.

```html
<!-- Page 1 -->
<div class="page">
  <div class="header">...</div>
  <div class="col-row">
    <div class="col-25">
      <div class="section">...</div>
    </div>
    <div class="col-25">...</div>
    <div class="col-25">...</div>
    <div class="col-25">...</div>
  </div>
  <div class="footer">...</div>
</div>

<!-- Page 2 — break on the wrapper, not mid-content -->
<div class="page" style="break-before:page; page-break-before:always;">
  <div class="header">...</div>
  <div class="col-row">
    <div class="col-50">   <!-- double-wide for long content -->
      <div class="section">...</div>
    </div>
    <div class="col-50">
      <div class="section">...</div>
      <div class="section">...</div>
    </div>
  </div>
  <div class="footer">...</div>
</div>
```

`.col-row` needs `font-size: 0` to eliminate inline-block gaps, with font-size restored on children:
```css
.col-row { font-size: 0; }
.col-row > * { font-size: 7.5pt; }
```

### When to use double-wide columns

If a section's content is estimated to be taller than ~120mm (e.g., a table with 20+ rows, multiple stacked sub-sections), give it a `col-50` (50% width) instead of `col-25`. This halves its height. A full-width `col-100` is also available for very long sections.

**Letter landscape usable content height** (after header + footer): ~166mm
**Row height at 7.5pt**: ~3.5mm
**Key grid row (5pt font)**: ~2.5mm

Rough estimates:
- Table row: 3.5mm → 45 rows = 157mm (use double-wide if >20 rows in one section)
- 8×2 key grid: ~12mm total
- Section header bar: 6mm
- h4 subheader: 5mm
- Note box: 8mm

### Fixing blank pages

If blank pages appear after generation:
1. **Check for non-breaking long strings in table cells.** This is the most common cause. Without `table-layout: fixed`, auto table layout expands columns to fit the longest unbreakable word — a 70-char string with no spaces can force a column to 100mm+, blowing up the entire page layout. Fix: add `table-layout: fixed` to the table element and `overflow-wrap: break-word; word-break: break-word` to `td, th`. Also add spaces around `/` separators in long slash-delimited strings so the browser has break points.
2. Check whether any column's total content height exceeds ~160mm — if so, switch that column to `col-50`
3. Remove low-priority content (verbose code tables, redundant specs)
4. Check page 2's `break-before: page` is on the `.page` wrapper div, not on an interior element
5. To isolate which HTML page is the culprit, test each page individually with Chrome headless and count the resulting PDF pages — any page producing more than 1 PDF page is overflowing.

---

## PDF Generation

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu \
  --print-to-pdf="output.pdf" \
  --print-to-pdf-no-header \
  --no-margins \
  "file:///path/to/file.html"
```

URL-encode spaces in paths: `EP-40%20cheat%20sheet`

---

## Visual Style

See `references/visual-style.md` for full CSS. Key rules:
- White background, brand color for headers/accents
- IBM Plex Mono font (Google Fonts)
- Section header: colored full-width bar, white text, uppercase, 6.5pt
- `kbd` tags for button names
- All-lowercase labels (TE convention)
- Letter landscape (8.5×11in), 10mm top/bottom, 12mm side margins

## Product Color Palettes

| Product | Primary | Tint | Border |
|---------|---------|------|--------|
| EP-40 Riddim | `#00503a` | `#ede8dd` | `#dbd0b9` |
| PO-12 Rhythm | `#c85000` | `#fdf2ec` | `#e8b09a` |
| PO-20 Arcade | `#7832b4` | `#f3ecfa` | `#c49ee0` |
| PO-33 K.O! | `#e8000d` | `#fdecea` | `#f5a0a3` |
| OP-1 Field | `#1a1a1a` | `#f5f5f5` | `#e0e0e0` |

## Content Organization

**Page 1** — controls, buttons, sounds/pads/keys, effects, core shortcuts
**Page 2** — connectivity/sync, detailed workflows, specs, system settings

Target 2 pages. Put high-frequency reference content on page 1.
