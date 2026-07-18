# Odyssey

Odyssey turns a prompt into an evidence-led, self-contained interactive HTML report through a durable Hyperchart workflow.

The repository contains the complete chart, agent prompts, deterministic renderer, workflow scripts and guards, tests, and a rendered e-ink example.

## Repository layout

- `chart.ts` — complete `research → plan → write → done` Hyperchart.
- `agents/` — Pi agent definitions used by the chart.
- `contracts/` — shared Zod schemas, inferred contract types, and actionable JSON parsing helpers.
- `engine/` — strict TypeScript render model and self-contained HTML renderer.
- `scripts/` — strict TypeScript workflow assembly, validation, retry-budget, screenshot, and routing scripts.
- `guards/` — Hyperchart semantic guards.
- `tests/` — renderer, responsive Playwright, and workflow fixture tests.
- `examples/eink/report-document.json` — typed example input.
- `examples/eink/report.html` — self-contained rendered example.

## Safety and publishing

This package is intentionally marked `private: true`. It is not configured for npm publication.

Agents produce typed JSON. They do not produce arbitrary HTML, CSS, JavaScript, or raw ECharts options. The renderer turns that typed document into deterministic self-contained HTML.

## Install

```bash
npm ci
npx playwright install chromium
```

Odyssey's `chart.ts` runs in Pi with the Hyperchart extension and `@surprisal/hyperchart` DSL available.

To install the chart and its agents into the current Pi user configuration:

```bash
mkdir -p ~/.pi/agent/hypercharts/odyssey ~/.agents
cp chart.ts ~/.pi/agent/hypercharts/odyssey/chart.ts
cp -R contracts engine guards scripts tests package.json package-lock.json tsconfig.json ~/.pi/agent/hypercharts/odyssey/
cp agents/*.md ~/.agents/
(cd ~/.pi/agent/hypercharts/odyssey && npm ci)
```

Agent filenames intentionally retain their stable `report-engine-*` runtime IDs because `chart.ts` references those IDs.

All runtime and test entrypoints use `tsx`; no JavaScript build or `dist/` directory is generated. Validate strict contracts with `npm run typecheck`.

## Render the example

```bash
npm run render:example
open artifacts/eink-report.html
```

The output is a self-contained HTML file.

## Test

```bash
npm test
```

Or run suites individually:

```bash
npm run test:renderer
npm run test:eink
npm run test:workflow-fixture
```

Renderer coverage includes:

- typed line, area, bar, grouped/stacked/100%-stacked bar, scatter, bubble, heatmap, treemap, sunburst, and sankey;
- sparse actual/forecast series without synthetic zeroes;
- point-level status encoding without fragmenting trends;
- `annotation-only` records kept outside plotted series;
- responsive navigation with 20 long chapter titles;
- desktop/mobile overflow, accessibility labels, chart semantics, and interactive legend filtering.

## Direct renderer API

```bash
DOCUMENT_FILE=/absolute/path/report-document.json \
OUTPUT_PATH=/absolute/path/report.html \
npx tsx engine/render-report.ts
```

Both environment variables are resolved from the current working directory when relative paths are supplied.
