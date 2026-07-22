# Odyssey

Odyssey turns a prompt into an evidence-led, self-contained interactive HTML report through a durable, typed [Hyperchart](https://github.com/surprisal/pi-hyperchart) workflow: three-angle research fans out into a content-addressed evidence index, a verified narrative plan, and parallel chapter production, ending in a deterministic renderer. Agents produce only typed JSON — every artifact is contract-validated, every loop is budget-bounded, and all HTML comes from one deterministic engine.

## Quickstart

```bash
npm ci
npx playwright install chromium

# make the chart discoverable to your Hyperchart host (pi shown; Claude Code: ~/.claude/hypercharts)
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

The finished report lands at `artifacts/report.html`. Role→model mappings, monitoring, failure recovery, and the test suite are covered in [docs/running.md](docs/running.md).

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
