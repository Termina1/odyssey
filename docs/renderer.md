# Renderer

The renderer is the only component in Odyssey that produces HTML — and the only one that runs without a Hyperchart host (plain `tsx`, see the direct API below). It is fully deterministic: the same `ReportDocument` always yields byte-identical output, which is what makes render bugs fixable once and screenshots meaningful as QA evidence.

## Two layers

- **`engine/render-model.ts`** — pure typed transforms from document blocks to render models: `buildChartModel(block, dataset, locale)` turns a typed chart block + dataset into a complete ECharts option (series, axes, legend, formatting), plus table models and shared formatting. Locale (`en | ru`, default `en`) affects number/date formatting. No I/O, no DOM — everything here is unit-testable.
- **`engine/render-report.ts`** — reads a `ReportDocument`, renders every block, and emits one self-contained HTML file: inline CSS, the ECharts runtime embedded from `node_modules` (no CDN, no network at view time), SSR'd SVG chart fallbacks with client-side hydration, and a small inline client for chart interactivity (legend toggling with correct ARIA state, zoom controls) and navigation (section progress, prev/next, reading-progress bar). It also writes a machine-readable **render review** (`render-review.json`) consumed by `validate-render` and visual QA — including a self-check that the embedded ECharts runtime is actually present.

## Input: `ReportDocument`

The document is typed end-to-end in `contracts/index.ts`. Block types the renderer supports:

`chart` · `metric-strip` · `table` · `comparison` · `timeline` · `flow` · `matrix` · `callout` · `quote` · `image`

Chart blocks bind a dataset by request ID and declare one of 12 variants:

`line` · `area` · `bar` · `stacked-bar` · `grouped-bar` · `100%-stacked-bar` · `scatter` · `bubble` · `heatmap` · `treemap` · `sunburst` · `sankey`

Agents never write ECharts options; they write these typed blocks, and `buildChartModel` owns the mapping. Renderer guarantees covered by tests:

- sparse actual/forecast series render without synthetic zeroes;
- point-level status encoding doesn't fragment a trend into disconnected series;
- `annotation-only` records stay out of plotted series;
- responsive navigation stays usable with 20 long chapter titles;
- desktop/mobile overflow, accessibility labels, chart semantics, and interactive legend filtering.

## Direct API

Render any document without the chart:

```bash
DOCUMENT_FILE=/absolute/path/report-document.json \
OUTPUT_PATH=/absolute/path/report.html \
npx tsx engine/render-report.ts
```

Relative paths resolve from the current working directory. `REVIEW_OUTPUT_PATH` optionally writes the render review. The repo ships a complete example:

```bash
npm run render:example    # renders examples/eink/report-document.json
open artifacts/eink-report.html
```

## Downstream checks

In the chart, `render-html` runs with `retries: 0` — a renderer failure is an engine bug, not something an agent retry can fix. After render:

- `scripts/validate-render.ts` checks the HTML + review deterministically (`render-validation.json`);
- `scripts/screenshot-report.ts` produces desktop/mobile tile screenshots via Playwright;
- the `visual-qa` agent judges only those screenshots, treating deterministic PASS as a technical prerequisite, not proof of visual quality ([pipeline.md](pipeline.md#manuscript-loop-render-visual-qa)).

## Tests

- `tests/renderer.test.ts` — render-model and renderer unit coverage (all chart variants, tables, edge cases) plus the `validate-elements` guard over fixtures.
- `tests/renderer-fixtures.ts` — shared typed fixtures.
- `tests/renderer-playwright.ts` (`npm run test:eink`) — renders the e-ink example and drives it in Chromium: responsive breakpoints, overflow, a11y labels, legend interaction.
