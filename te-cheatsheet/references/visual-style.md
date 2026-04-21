# TE Cheatsheet Visual Style Reference

## Page Setup
```css
@page {
  size: letter landscape;
  margin: 10mm 12mm;
}
body {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 7.5pt;
  line-height: 1.4;
  background: #ffffff;
}
```

## Section Cards
```css
.section {
  display: inline-block;
  width: 100%;
  background: #ffffff;
  border: 1px solid VAR_BORDER;
  border-radius: 2px;
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 8px;
}
.section-header {
  background: VAR_PRIMARY;
  color: #ffffff;
  font-size: 6.5pt;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 3px 6px;
}
.section-body { padding: 4px 6px; }
```

## Tables
```css
table { width: 100%; border-collapse: collapse; font-size: 7pt; }
td, th { padding: 1.5px 4px; vertical-align: top; border-bottom: 1px solid VAR_LIGHT; }
tr:last-child td { border-bottom: none; }
th {
  color: VAR_PRIMARY; font-weight: 600; font-size: 6pt;
  text-transform: uppercase; letter-spacing: 0.5px;
  background: VAR_TINT; border-bottom: 1px solid VAR_BORDER;
}
td:first-child { color: VAR_PRIMARY; font-weight: 500; white-space: nowrap; }
```

## kbd Tags (button names)
```css
kbd {
  display: inline-block;
  background: VAR_TINT;
  border: 1px solid VAR_BORDER;
  border-radius: 2px;
  padding: 0px 3px;
  font-size: 6.5pt;
  font-family: inherit;
  color: VAR_DARK;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}
```

## Subsection Headers (h4)
```css
h4 {
  font-size: 6.5pt; font-weight: 600;
  color: VAR_PRIMARY;
  text-transform: uppercase; letter-spacing: 1px;
  margin-bottom: 2px; margin-top: 4px;
  break-after: avoid;
  page-break-after: avoid;
}
```

## Note/Callout Boxes
```css
.note {
  background: VAR_TINT;
  border-left: 2px solid VAR_PRIMARY;
  padding: 3px 5px;
  font-size: 6.5pt;
  color: #6b6b6b;
  margin-top: 3px;
}
```

## Page Header & Footer
```css
.header {
  display: flex; justify-content: space-between; align-items: flex-end;
  border-bottom: 2px solid VAR_PRIMARY;
  padding-bottom: 4px; margin-bottom: 8px;
}
.header-title { font-size: 18pt; font-weight: 600; color: VAR_PRIMARY; letter-spacing: -0.5px; }
.header-sub { font-size: 7pt; color: #6b6b6b; letter-spacing: 1px; text-transform: uppercase; }
.footer {
  margin-top: 6px; border-top: 1px solid VAR_BORDER;
  padding-top: 3px; display: flex; justify-content: space-between;
  font-size: 6pt; color: #6b6b6b;
}
```

## 16-Key Grid (for Pocket Operators)
Pocket Operators have 16 keys — display sounds/effects/chords in a compact 8×2 grid:
```css
.key-grid {
  display: grid;   /* OK here — this is a small fixed grid, not page-spanning */
  grid-template-columns: repeat(8, 1fr);
  gap: 2px; padding: 4px 6px;
}
.key-cell { border: 1px solid VAR_BORDER; border-radius: 2px; padding: 2px 3px; text-align: center; }
.key-num { font-size: 5pt; color: VAR_PRIMARY; font-weight: 600; display: block; }
.key-label { font-size: 5.5pt; display: block; line-height: 1.3; }
```

**Critical — use `minmax(0, 1fr)` not `1fr`:** Plain `1fr` has an implicit `min-content` minimum width. Inside a constrained flex column, cells refuse to shrink below their content width, overflowing the flex item and causing overlapping text in adjacent columns. Always use `repeat(N, minmax(0, 1fr))`.

Also set `min-width: 0; overflow: hidden` on grid cells (`.kc`) and `overflow: hidden` on the parent `.section` to contain any remaining overflow.

`display: grid` is fine for small, fixed-size grids that won't span pages (like this 8×2 key grid). The restriction is only on full-page-width multi-column layout containers.

## Spec Lists
```css
.spec-list { list-style: none; }
.spec-list li {
  display: flex; justify-content: space-between;
  padding: 1.5px 0; border-bottom: 1px solid VAR_LIGHT;
  font-size: 6.5pt; gap: 6px;
}
.spec-list .sk { color: #6b6b6b; }
.spec-list .sv { font-weight: 500; text-align: right; }
```
