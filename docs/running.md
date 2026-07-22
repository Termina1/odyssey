# Running Odyssey

## Prerequisites

Odyssey does not run standalone. You need:

1. **A Hyperchart host** — pi with the hyperchart extension, or Claude Code with the hyperchart plugin (both live in the pi-hyperchart repo). The host owns agent sessions, the durable log, dashboards, and role/toolset resolution; this repo only supplies the chart, agents, contracts, scripts, and renderer.
2. **pi-hyperchart checked out as a sibling of this repo** — `package.json` links `@surprisal/hyperchart` from `../pi-hyperchart/packages/hyperchart`.
3. **`npm install`** — chart scripts and guards execute through the workflow-local `node_modules/.bin/tsx`, so without installed dependencies every script state fails. There is no build step; `npm run typecheck` validates the strict contracts.
4. **Chromium via Playwright — only for `report`/`release` polish** (`npx playwright install chromium`): the screenshot-QA loop drives a headless browser. `draft` runs and the renderer itself don't need it. (`npm run test:eink` needs it too.)

### Make the chart discoverable

Link the repository into a Hyperchart scope instead of copying it:

```bash
# pi user scope
ln -sfn "$HOME/Work/odyssey" "$HOME/.pi/agent/hypercharts/odyssey"
# Claude Code user scope
ln -sfn "$HOME/Work/odyssey" "$HOME/.claude/hypercharts/odyssey"
```

Hosts discover charts in: project chart directory → shared `<repo>/.hypercharts/` → user directory. Make sure the [role/toolset mappings](agents.md#configuring-the-mappings) exist in a `settings.json` the host will resolve — Odyssey's agents have no concrete model fallbacks by design, so an unmapped role fails the state instead of silently picking a default.

## Arguments

| Arg | Type | Meaning |
| --- | --- | --- |
| `prompt` | string | The report request, verbatim. Drives research, strategy, and chapter planning. |
| `evidenceDepth` | `skim \| standard \| deep` | How much research to buy. |
| `productionPolish` | `draft \| report \| release` | How much review to buy. |

Both knobs resolve to hard caps in `contracts/constants.ts` — scripts and guards enforce them; agents are told them:

### `evidenceDepth` (`RESEARCH_CAPS`)

| Depth | Deep takes (max) | Sources per take | Findings per take |
| --- | --- | --- | --- |
| `skim` | 4 | 4 | 8 |
| `standard` | 10 | 8 | 20 |
| `deep` | 24 | 16 | 48 |

### `productionPolish` (`PRODUCTION_CAPS`)

| Polish | Evidence register review | Manuscript gate | Chapter rewrite rounds | Visual QA passes |
| --- | --- | --- | --- | --- |
| `draft` | skipped | skipped | 0 | 0 (no screenshots/QA) |
| `report` | on | on | 2 | 1 |
| `release` | on | on | 3 | 2 |

`draft` is the fast loop for iterating on the pipeline itself: it renders straight from assembled chapters. A `skim`/`draft` run has completed in ~35–40 minutes wall-clock; `deep`/`release` multiplies both research volume and review rounds.

## Launching

From Claude Code (hyperchart plugin), find the chart with `hyperchart_list` and start it detached:

```
hyperchart_run  chartPath: "…/odyssey/chart.ts"  args: {
  "prompt": "Brief research report: …",
  "evidenceDepth": "standard",
  "productionPolish": "report"
}
```

From pi, the consolidated `hyperchart` tool takes the same chart path and args. Resume an interrupted run by passing its `runDir` instead of a chart path. Progress is observable via `hyperchart_run_inspect` (compact digest; `verbose: true` for the full object), the live dashboard (`hyperchart_view`), and the statusline. The run executes with the chart's directory as `cwd`, so all artifacts land in this repo's `artifacts/`.

## Outcomes

| Final state | Meaning |
| --- | --- |
| `done` | Report shipped clean: `artifacts/report.html`. |
| `done-with-warnings` | Report shipped; unresolved QA findings recorded in `artifacts/write/visual-qa-warnings.json`. |
| `failed` | The run stopped — see below. |

## Failure and recovery

Three distinct failure classes show up in practice; distinguish them before acting.

**1. Fail-closed outcomes (by design).** `planning-invalid` (beat topology unrepairable within budget) and `closure-blocked` (assembled plan fails closure) end the run deliberately. The reason is in the state's output and the corresponding artifact (`closure-review.json`, routing feedback). Fix is content-level: usually a weaker prompt/evidence combination — rerun with more depth or a sharper prompt.

**2. Guard-exhausted states.** A state burned its retries against a guard. Inspect the state's validation feedback in the run inspect digest; if the guard message was precise, the agent genuinely couldn't satisfy the contract. If the guard message was vague or wrong, fix the guard — see the [guard-writing rules](contracts-and-guards.md#guard-writing-rules); a misleading message reliably sends every retry in the wrong direction.

**3. Infrastructure failures.** Network outages and account session limits surface as errored agent sessions whose `FAILED` events are **durable log facts** — a plain resume replays the log and lands right back in `failed`. Recovery is rewind, never log editing:

```
hyperchart_rewind  runDir: <run dir>  seqId: <last-good seq>   # backs up, truncates, cleans sessions
hyperchart_run     …                                           # resume continues from the rewound frontier
```

Rewind takes a backup first and can target a state path (`state: "plan.verify-beats#key.verify"`), a log `seqId`, or `to: "compatible"` (cut to the longest prefix compatible with the current chart after a chart edit); completed work before the rewind point is preserved and replays instantly. Everything the run wrote stays under `artifacts/` and versioned artifacts survive rewinds, so completed research is never re-bought.

## Tests

```bash
npm test                     # typecheck + all suites
npm run test:contracts       # contract coverage over the parsed chart AST + contract/budget unit tests
npm run test:renderer        # render-model + renderer unit tests
npm run test:eink            # render the e-ink example + Playwright responsive/a11y checks
npm run test:workflow-fixture# drives write-stage scripts and guards over a fixture chapter
npm run check                # biome format + lint + import organization
```

`tests/chart-contract-coverage.test.ts` is the one to remember when editing `chart.ts` or `contracts/constants.ts`: it parses the chart AST and asserts that every reply and shaped artifact carries a registered runtime contract (with exact counts, so adding states forces a conscious update), that every script/guard invocation uses the workflow-local `tsx` binary by absolute path, and that agent prompt bodies still quote the hard caps from `constants.ts` — changing a cap without updating the prompts fails the suite.
