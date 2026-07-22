# Odyssey

Odyssey turns a prompt into an evidence-led, self-contained interactive HTML report through a durable, typed [Hyperchart](https://github.com/surprisal/pi-hyperchart) workflow: three-angle research fans out into a content-addressed evidence index, a verified narrative plan, and parallel chapter production, ending in a deterministic renderer. Agents produce only typed JSON — every artifact is contract-validated, every loop is budget-bounded, and all HTML comes from one deterministic engine.

## Running it

Odyssey is a Hyperchart chart, not a standalone app. `chart.ts` runs only inside a Hyperchart host — pi with the hyperchart extension, or Claude Code with the hyperchart plugin — which owns the agent sessions, the durable log, and role→model resolution. This repo supplies the chart, agents, contracts, scripts, and renderer; the renderer is the only piece that works without a host ([docs/renderer.md](docs/renderer.md)).

```bash
# pi-hyperchart must be checked out next to this repo — @surprisal/hyperchart links to it
npm install

# make the chart discoverable to the host (pi shown; Claude Code: ~/.claude/hypercharts)
ln -sfn "$(pwd)" ~/.pi/agent/hypercharts/odyssey
```

Then launch `chart.ts` from the host:

```
hyperchart_run  chartPath: "~/.pi/agent/hypercharts/odyssey/chart.ts"  args: {
  "prompt": "Brief research report: …",
  "evidenceDepth": "standard",     # skim | standard | deep — how much research to buy
  "productionPolish": "report"     # draft | report | release — how much review to buy
}
```

The finished report lands at `artifacts/report.html`. Chromium (`npx playwright install chromium`) is needed only for `report`/`release` polish, whose screenshot-QA loop drives a headless browser — `draft` runs without it. Role→model mappings, monitoring, failure recovery, and the test suite are covered in [docs/running.md](docs/running.md).

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | The pipeline at a glance and the eight design principles. |
| [docs/pipeline.md](docs/pipeline.md) | State-by-state reference for all three stages: every agent, guard, loop, and budget. |
| [docs/agents.md](docs/agents.md) | The 14 agents, the role/toolset system, and host model mappings. |
| [docs/contracts-and-guards.md](docs/contracts-and-guards.md) | Validation layering, guard-writing rules, and the full artifact map. |
| [docs/running.md](docs/running.md) | Install, arguments, launching, failure recovery, tests. |
| [docs/renderer.md](docs/renderer.md) | The render model, supported blocks and chart variants, direct API. |

## License

[MIT](LICENSE)
