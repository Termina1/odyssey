# Odyssey

Odyssey turns a prompt into an evidence-led, self-contained interactive HTML report through a durable, typed [Hyperchart](https://github.com/surprisal/pi-hyperchart) workflow: three-angle research fans out into a content-addressed evidence index, a verified narrative plan, and parallel chapter production, ending in a deterministic renderer. Agents produce only typed JSON — every artifact is contract-validated, every loop is budget-bounded, and all HTML comes from one deterministic engine.

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | The pipeline at a glance and the eight design principles. |
| [docs/pipeline.md](docs/pipeline.md) | State-by-state reference for all three stages: every agent, guard, loop, and budget. |
| [docs/agents.md](docs/agents.md) | The 14 agents, the role/toolset system, and host model mappings. |
| [docs/contracts-and-guards.md](docs/contracts-and-guards.md) | Validation layering, guard-writing rules, and the full artifact map. |
| [docs/running.md](docs/running.md) | Install, arguments (`evidenceDepth`, `productionPolish`), launching, failure recovery, tests. |
| [docs/renderer.md](docs/renderer.md) | The render model, supported blocks and chart variants, direct API. |

## Quickstart

```bash
npm ci
npx playwright install chromium

# render the bundled example
npm run render:example
open artifacts/eink-report.html

# full test suite (typecheck + contracts + renderer + Playwright + workflow fixture)
npm test
```

To run the actual report engine, link the repo into a Hyperchart scope and launch `chart.ts` with a prompt — see [docs/running.md](docs/running.md).

## Repository layout

- `chart.ts` — the complete `research → plan → write` Hyperchart.
- `agents/` — agent definitions (stable `report-engine-*` IDs referenced by the chart).
- `contracts/` — shared Zod schemas, registered runtime contracts, cap constants, parsing helpers.
- `guards/` — deterministic validation guards.
- `scripts/` — deterministic assembly, routing, budget, packet, patch, and screenshot scripts.
- `engine/` — typed render model and self-contained HTML renderer.
- `tests/` — contract-coverage, contract, renderer, Playwright, and workflow-fixture tests.
- `examples/eink/` — typed example document and its rendered HTML.

## Safety and publishing

This package is intentionally `private: true` and not configured for npm publication.

Agents never produce HTML, CSS, JavaScript, or raw ECharts options — they emit typed JSON that the deterministic renderer turns into self-contained HTML. This is both a safety boundary against injected markup from web research and the reason renders are reproducible.

## Code quality

Biome is the single formatter, linter, and import organizer; generated e-ink artifacts and `package-lock.json` are excluded.

```bash
npm run check   # formatting + lint + import organization
npm run typecheck
```

All runtime and test entrypoints use `tsx`; no JavaScript build or `dist/` directory is generated.
