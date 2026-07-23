# Odyssey

Odyssey turns a prompt into an evidence-led, self-contained interactive HTML report. It is one durable [Hyperchart](https://github.com/surprisal/pi-hyperchart) statechart (`chart.ts`) plus 14 agent definitions, deterministic TypeScript scripts and guards, shared Zod contracts, and a deterministic renderer.

It is not a standalone app: the chart runs only inside a Hyperchart host — pi with the hyperchart extension, or Claude Code with the hyperchart plugin — which owns agent sessions, the durable log, and role→model resolution. The only piece that works without a host is the renderer.

## How it works

```
research ──► plan ──► write ──► artifacts/report.html
```

- **research** — three parallel scout angles (landscape / evidence / tensions), then a planner writes a narrative skeleton and a deep-research agenda; scouts map over the takes (concurrency 6), each gated with a bounded retry loop. A deterministic script merges everything into an immutable **evidence index** with content-hashed IDs (`s_…` sources, `e_…` claims) that everything downstream cites.
- **plan** — narrative strategy (gated), then section-parallel beat drafting into a stable candidate with deterministic topology routing and bounded micro-patches; finally per-beat verification (map, concurrency 8) runs **in parallel with** the single global layout/experience pass. A deterministic closure check fails the run rather than shipping an unsound plan.
- **write** — chapters map in parallel (concurrency 5): chapter plan → lazy visual acquisition (only for dataset-backed beats, with gate + deterministic fallback) → typed element blocks → copy, each step guard-validated. An assembled manuscript passes a whole-report gate with owner-routed rework (`layout`/`elements`/`copy`), then the deterministic renderer emits one self-contained HTML file; screenshot-based visual QA runs at higher polish levels.

Design rules the whole repo follows: agents emit typed JSON only (never HTML/CSS/JS — the renderer owns markup); everything computable is a deterministic script, agents exist only for judgment; every agent artifact passes Zod contracts plus cross-artifact guards that report **all** violations with exact field names; every review loop has a deterministic budget — quality gates cannot spin, and the run either fails closed (unsound plan) or finishes with recorded warnings (`artifacts/write/visual-qa-warnings.json`).

## Running

Prerequisites:

1. A Hyperchart host (pi extension or Claude Code plugin, both from the pi-hyperchart repo).
2. `npm install` — installs the published `@surprisal/hyperchart` package and the chart scripts' workflow-local `node_modules/.bin/tsx`.
3. Chromium only for `report`/`release` polish (`npx playwright install chromium`) — the screenshot-QA loop drives a headless browser; `draft` runs without it.

```bash
npm install
# make the chart discoverable (pi shown; Claude Code: ~/.claude/hypercharts)
ln -sfn "$(pwd)" ~/.pi/agent/hypercharts/odyssey
```

Launch from the host:

```
hyperchart_run  chartPath: "…/odyssey/chart.ts"  args: {
  "prompt": "Brief research report: …",
  "evidenceDepth": "standard",
  "productionPolish": "report"
}
```

The finished report lands at `artifacts/report.html` (final state `done`, or `done-with-warnings` with the QA findings recorded). Watch progress with `hyperchart_run_inspect` / `hyperchart_view`.

### Arguments

Both knobs resolve to hard caps in `contracts/constants.ts`; scripts and guards enforce them.

| `evidenceDepth` | Deep takes | Sources/take | Findings/take |
| --- | --- | --- | --- |
| `skim` | 4 | 4 | 8 |
| `standard` | 10 | 8 | 20 |
| `deep` | 24 | 16 | 48 |

| `productionPolish` | Register review | Manuscript gate | Chapter rewrites | Visual QA passes |
| --- | --- | --- | --- | --- |
| `draft` | skipped | skipped | 0 | 0 (no browser) |
| `report` | on | on | 2 | 1 |
| `release` | on | on | 3 | 2 |

`draft` is the fast iteration loop; a `skim`/`draft` run has completed in ~35–40 minutes wall-clock.

### Failure and recovery

Three failure classes: **fail-closed outcomes** (unrepairable beat topology, failed closure — deliberate stops; fix the prompt/depth and rerun), **guard-exhausted states** (an agent burned its retries; read the guard feedback in the run inspect), and **infrastructure failures** (network, session limits — the `FAILED` event is a durable log fact, so recover with `hyperchart_rewind` to the last good point and resume; never edit the log by hand). Completed work replays from the log and is never re-bought.

## Agents and model mappings

Agent definitions in `agents/` use symbolic `role` (`planner` / `reviewer` / `research-reviewer` / `worker`) and `toolset` (`reading` / `authoring` / `researching`) frontmatter instead of concrete models and tools, so the same chart runs under either host. Mappings live in the host's `settings.json` (project chart dir → shared `.hypercharts/` → user dir), flat or with per-host `"pi"` / `"claude"` sections:

```json
{
  "pi":     { "roles": { "planner": "openai-codex/gpt-5.6-luna", "worker": "deepseek/deepseek-v4-pro", … },
              "toolsets": { "reading": ["read"], "researching": ["read", "write", "web_search", "browser"], … } },
  "claude": { "roles": { "planner": "claude-opus-4-8", "worker": "claude-haiku-4-5", … },
              "toolsets": { "reading": ["Read"], "researching": ["Read", "Write", "WebSearch", "WebFetch"], … } }
}
```

Keep `planner` on the strongest tier (planning mistakes surface many states later); `worker` tolerates the cheapest capable tier because guards catch its mistakes locally. Gates use the read-only toolset on purpose — a gate that cannot write cannot edit what it judges. Agent filenames are stable `report-engine-*` IDs referenced by `chart.ts`; don't rename them.

## Renderer

`engine/render-model.ts` (pure typed transforms → ECharts options, unit-testable) + `engine/render-report.ts` (one self-contained HTML file: inline CSS, embedded ECharts, SSR'd SVG fallbacks with hydration, interactive legend/zoom/navigation, plus a machine-readable render review). Blocks: `chart` (12 variants: line, area, bar, stacked/grouped/100%-stacked bar, scatter, bubble, heatmap, treemap, sunburst, sankey) · `metric-strip` · `table` · `comparison` · `timeline` · `flow` · `matrix` · `callout` · `quote` · `image`.

Render any document without the chart:

```bash
DOCUMENT_FILE=examples/eink/report-document.json OUTPUT_PATH=artifacts/report.html npx tsx engine/render-report.ts
# or: npm run render:example
```

## Repository layout

- `chart.ts` — the complete chart; `agents/` — agent definitions; `contracts/` — Zod schemas, runtime contracts, cap constants; `guards/` — deterministic validation guards; `scripts/` — assembly, routing, budget, packet, patch, and screenshot scripts; `engine/` — the renderer; `examples/eink/` — a typed example document and its rendered HTML; `artifacts/` — run output (gitignored).

## Tests

```bash
npm test                      # typecheck + all suites
npm run test:chart            # the full chart on the hyperchart runtime with scripted agents —
                              #   real scripts, guards, routers, budgets, contracts, renderer; ~9s, zero tokens
npm run test:scripts          # deterministic script/guard behavior, mostly negative paths
npm run test:workflow-fixture # write-stage scripts + renderer + screenshots over a fixture chapter
```

`test:chart` is the one to remember when editing `chart.ts`: a broken transition, unregistered contract, or unsatisfiable guard fails it in seconds.

## License

[MIT](LICENSE)
