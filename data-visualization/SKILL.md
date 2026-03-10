---
name: data-visualization
description: >
  Audits and redesigns data visualizations (Chart.js, matplotlib, seaborn, plotly, D3,
  plain HTML/CSS charts) to meet professional quality standards. Use this skill whenever
  the user mentions that a chart, graph, or visualization looks bad, needs improvement,
  or needs to be created with high quality. Also trigger when: building a new chart,
  adding data visualization to a web page or notebook, improving chart colors/styling/layout,
  making charts accessible, ensuring charts are consistent with a dark or light theme.
  Even if the user just says "fix my chart", "this doesn't look good", or points at
  visualization code and says it looks unprofessional — use this skill. Also use for:
  "add a graph", "make a better chart", "the viz looks off".
---

# Visualization Quality Skill

You are a data visualization expert. Your job is to produce charts and graphs that are
beautiful, clear, and consistent — output that a professional designer would be proud of.

## Choosing Python vs JavaScript

**Use Python (matplotlib/seaborn/plotly) when:**
- The data lives in Python already (pandas DataFrame, DB query result, script output)
- The chart is static or only needs to refresh on page load
- You're working in a Jupyter notebook or generating files to serve
- The chart is complex (multi-panel, statistical annotations, heatmaps)

**Use Chart.js when:**
- The chart must update live in the browser without a page reload
- You're building a single-page app with dynamic filtering
- The server can't generate images on demand

When in doubt, prefer Python. It produces crisper output, is easier to test, and keeps
visualization logic out of the frontend.

---

## Phase 1: Audit

Before writing any code, read the existing visualization code and surrounding context.
State your findings in 3–5 bullet points covering:

- **Colors** — contrast, palette consistency, dark/light background compatibility
- **Typography** — font sizes, weights, label readability
- **Axes** — labels present? Ticks formatted (currency, %, dates)?
- **Legend** — readable, well-positioned, not obscuring data?
- **Tooltips / annotations** — useful, formatted, not cluttering?
- **Responsiveness / sizing** — sensible figure size and DPI?
- **States** — empty, loading, error handled?
- **Grid lines** — subtle enough to guide without competing with data?

---

## Phase 2: Design Decisions

Make these decisions explicitly before writing code:

1. **Python vs JS** — which renderer, and why?
2. **Color assignments** — which palette color maps to which series?
3. **Solid vs. dashed** — solid = primary metric, dashed = secondary/derived
4. **Figure size** — width × height in inches (Python) or px (JS)
5. **Legend placement** — outside/top for ≤3 series; bottom/right for ≥4
6. **Value formatting** — list every axis tick and tooltip format with units

---

## Phase 3: Implementation

### Color Palette

Use this palette for both Python and JS. Never invent ad-hoc hex values.

```python
VIZ_PALETTE = [
    "#60a5fa",  # blue    — primary series
    "#34d399",  # emerald — secondary
    "#fbbf24",  # amber   — accent / warnings
    "#fb7185",  # rose    — negative / missing
    "#a78bfa",  # violet  — fifth series
    "#22d3ee",  # cyan    — sixth series
    "#fb923c",  # orange  — seventh
    "#a3e635",  # lime    — eighth
]
```

```javascript
const VIZ_PALETTE = [
  { key: 'blue',    hex: '#60a5fa' },
  { key: 'emerald', hex: '#34d399' },
  { key: 'amber',   hex: '#fbbf24' },
  { key: 'rose',    hex: '#fb7185' },
  { key: 'violet',  hex: '#a78bfa' },
  { key: 'cyan',    hex: '#22d3ee' },
  { key: 'orange',  hex: '#fb923c' },
  { key: 'lime',    hex: '#a3e635' },
];
```

These colors are distinguishable, vibrant on dark backgrounds, and reasonably accessible
for the most common forms of color blindness.

---

### Python: matplotlib / seaborn

#### Standard Figure Setup

```python
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

DARK_BG   = "#0d0d0d"
PANEL_BG  = "#1a1a1a"
GRID_CLR  = "#2a2a2a"
TEXT_CLR  = "#e8e8e8"
MUTED_CLR = "#64748b"

def apply_dark_style(fig, ax):
    """Apply consistent dark theme to a figure/axes pair."""
    fig.patch.set_facecolor(DARK_BG)
    ax.set_facecolor(PANEL_BG)
    ax.tick_params(colors=MUTED_CLR, labelsize=10)
    ax.xaxis.label.set_color(MUTED_CLR)
    ax.yaxis.label.set_color(MUTED_CLR)
    ax.title.set_color(TEXT_CLR)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(axis='y', color=GRID_CLR, linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
```

#### Standard Save

Always save at 150 DPI minimum for crisp display on retina screens.
Use `bbox_inches='tight'` to avoid clipping labels.

```python
def save_chart(fig, path, dpi=150):
    fig.savefig(path, dpi=dpi, bbox_inches='tight',
                facecolor=fig.get_facecolor())
    plt.close(fig)
```

#### Line Chart Template

```python
fig, ax = plt.subplots(figsize=(10, 4))
apply_dark_style(fig, ax)

for i, (label, dates, values) in enumerate(series):
    color = VIZ_PALETTE[i % len(VIZ_PALETTE)]
    ax.plot(dates, values, color=color, linewidth=2,
            label=label, marker='o', markersize=3)

ax.yaxis.set_major_formatter(mticker.FuncFormatter(
    lambda v, _: f"${v:,.0f}"
))
ax.xaxis.set_major_locator(mticker.MaxNLocator(10))
fig.autofmt_xdate(rotation=0, ha='center')

ax.legend(frameon=False, labelcolor=TEXT_CLR,
          fontsize=10, loc='upper left')
fig.tight_layout()
save_chart(fig, "output.png")
```

#### Bar Chart Template

```python
fig, ax = plt.subplots(figsize=(9, 4))
apply_dark_style(fig, ax)

colors = [VIZ_PALETTE[i % len(VIZ_PALETTE)] for i in range(len(labels))]
bars = ax.bar(labels, values, color=colors, width=0.6,
              zorder=3, linewidth=0)

# Value labels on top of bars
for bar, val in zip(bars, values):
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(values) * 0.01,
            f"{val:,}", ha='center', va='bottom',
            color=MUTED_CLR, fontsize=9)

ax.yaxis.set_major_formatter(mticker.FuncFormatter(
    lambda v, _: f"{v:,.0f}"
))
ax.set_ylim(0, max(values) * 1.15)
fig.tight_layout()
save_chart(fig, "output.png")
```

#### Serving from Flask

```python
import io
from flask import send_file

@app.route('/charts/my-chart.png')
def my_chart():
    fig, ax = plt.subplots(figsize=(10, 4))
    # ... build chart ...
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return send_file(buf, mimetype='image/png')
```

Then in the HTML:
```html
<img src="/charts/my-chart.png" style="width:100%; border-radius:8px;" alt="Chart description">
```

#### Using Plotly (for interactive Python charts)

Plotly renders in the browser but is driven by Python data — best of both worlds
when you need interactivity without writing JS.

```python
import plotly.graph_objects as go

fig = go.Figure()
for i, (label, x, y) in enumerate(series):
    fig.add_trace(go.Scatter(
        x=x, y=y, name=label,
        line=dict(color=VIZ_PALETTE[i % len(VIZ_PALETTE)], width=2),
        mode='lines+markers',
        marker=dict(size=4),
    ))

fig.update_layout(
    paper_bgcolor=DARK_BG,
    plot_bgcolor=PANEL_BG,
    font=dict(color=TEXT_CLR, size=12),
    legend=dict(bgcolor='rgba(0,0,0,0)', font=dict(color=TEXT_CLR)),
    # For daily time-series: tickmode="linear" + dtick="D1" ensures exactly one tick per day.
    # Without this, Plotly interpolates sub-day gradations when data is sparse.
    xaxis=dict(gridcolor=GRID_CLR, showline=False, tickfont=dict(color=MUTED_CLR),
               tickmode="linear", dtick="D1", tickformat="%b %d, %Y"),
    yaxis=dict(gridcolor=GRID_CLR, showline=False, tickfont=dict(color=MUTED_CLR),
               tickprefix='$', tickformat=',.0f'),
    margin=dict(l=50, r=20, t=30, b=40),
    hovermode='x unified',
)

# Embed in Flask template
chart_json = fig.to_json()
```

Then in the template:
```html
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js">< /script>
<div id="myChart" style="height:320px;"></div>
<script>
  Plotly.newPlot('myChart', JSON.parse('{{ chart_json | tojson }}').data,
                 JSON.parse('{{ chart_json | tojson }}').layout,
                 {responsive: true, displayModeBar: false});
< /script>
```

---

### JavaScript: Chart.js

Use Chart.js only when Python can't serve the chart (live filtering, no server round-trip).

#### Global Defaults (set once)

```javascript
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = getComputedStyle(document.body)
  .getPropertyValue('--font-sans') || "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
```

#### Dataset Builder

```javascript
function buildDataset(label, data, colorHex, { dashed = false, filled = false } = {}) {
  return {
    label, data,
    borderColor: colorHex,
    backgroundColor: filled ? colorHex + '18' : 'transparent',
    borderWidth: dashed ? 1.5 : 2,
    borderDash: dashed ? [5, 4] : [],
    pointRadius: 3, pointHoverRadius: 6,
    pointBackgroundColor: colorHex,
    pointBorderColor: 'transparent',
    tension: 0.35, fill: filled, spanGaps: true,
  };
}
```

#### Standard Options

```javascript
const CHART_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  animation: { duration: 350, easing: 'easeInOutQuart' },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top', align: 'start',
      labels: { color: '#e2e8f0', font: { size: 12 }, padding: 16 } },
    tooltip: {
      backgroundColor: 'rgba(10,10,20,0.95)',
      borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
      titleColor: '#e2e8f0', bodyColor: '#94a3b8',
      padding: { x: 14, y: 10 }, cornerRadius: 8,
      callbacks: {
        label: ctx => ` ${ctx.dataset.label}: ${formatChartValue(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: { border: { display: false },
         grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
         ticks: { color: '#64748b', padding: 8, maxTicksLimit: 10, maxRotation: 0 } },
    y: { border: { display: false },
         grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
         ticks: { color: '#64748b', padding: 8,
                  callback: v => '$' + v.toLocaleString('en-US') } },
  },
};
```

#### Container CSS & Graceful States

```css
.chart-wrap { position: relative; height: 280px; width: 100%; }
.chart-state { display: flex; flex-direction: column; align-items: center;
               justify-content: center; height: 100%; gap: 0.5rem;
               font-size: 0.875rem; color: #64748b; text-align: center; }
.chart-state__icon { font-size: 1.5rem; opacity: 0.5; }
.chart-state--error { color: #fb7185; }
.chart-state--error .chart-state__icon { opacity: 1; }
```

```javascript
function showChartState(container, type, message = '') {
  const icons = { loading: '⏳', empty: '📭', error: '⚠️' };
  container.innerHTML = `
    <div class="chart-state chart-state--${type}">
      <span class="chart-state__icon">${icons[type]}</span>
      <span class="chart-state__msg">${message}</span>
    </div>`;
}

function formatChartValue(v, type = 'currency') {
  if (v == null) return '—';
  if (type === 'currency')
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'percent') return v.toFixed(1) + '%';
  if (type === 'count') return v.toLocaleString('en-US');
  return String(v);
}
```

---

## Quality Bar

Before declaring the work done, verify every item:

1. All tooltip / annotation values are formatted with units (never raw floats)
2. Axis ticks are formatted to match the data type
3. Legend is readable with no truncation at normal screen widths
4. Colors come exclusively from `VIZ_PALETTE`
5. Chart renders correctly at both ~400px and ~1200px wide
6. Empty, loading, and error states are handled (JS) or a clear fallback exists (Python)
7. Figure saved at ≥150 DPI with `bbox_inches='tight'` (Python)
8. Canvas has a descriptive `aria-label`; `<img>` tags have descriptive `alt` text
9. No hardcoded `width`/`height` on canvas elements or `figsize` that ignores the data density
10. **Daily time-series axes:** always set `tickmode="linear"` and `dtick="D1"` (Plotly) or `unit: 'day'` + `stepSize: 1` (Chart.js) so each calendar day gets exactly one tick — never multiple sub-day gradations
