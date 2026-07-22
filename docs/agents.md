# Agents, roles, and toolsets

Odyssey ships 14 agent definitions in `agents/`. Filenames equal their stable runtime IDs (`report-engine-*`), which `chart.ts` references directly — do not rename them.

## Definition conventions

Every definition uses the same frontmatter shape:

```yaml
name: report-engine-beat-verifier
description: Verifies one narrative beat against a compact evidence packet…
role: reviewer          # symbolic — resolved to a model via host settings
toolset: authoring      # symbolic — resolved to concrete tools via host settings
thinking: xhigh
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
defaultContext: fresh
```

Deliberate choices:

- **`role`/`toolset` instead of `model`/`tools`.** Definitions stay host-neutral; the same chart runs under pi or Claude Code with per-host model mappings. There are intentionally no concrete fallbacks in frontmatter — a missing mapping should fail loudly, not silently pick a model.
- **`systemPromptMode: replace`, no inherited context/skills, fresh sessions.** Each invocation sees only its task, the supplied packet/artifacts, and its own definition body. This keeps fan-out states cheap, reproducible, and immune to cross-item contamination.
- **`thinking: xhigh`** everywhere except the layout planner (`high`), whose single global pass is long by volume rather than by reasoning depth.

## The four roles

| Role | Used for | Intuition |
| --- | --- | --- |
| `planner` | agenda/strategy/beat planning, chapter planning, register review | The strongest reasoning tier; every decision here shapes everything downstream. |
| `reviewer` | strategy gate, beat verification, visual gate, manuscript gate, visual QA | Judgment over bounded inputs; strong but doesn't need planner-grade depth. |
| `research-reviewer` | deep-research take gate | The highest-volume gate (one call per take); a cheaper tier keeps it economical. |
| `worker` | research scouts, visual acquisition, element generation, copywriting | High-volume production against tight contracts and guards. |

## The three toolsets

| Toolset | pi mapping (example) | Claude mapping (example) | Used by |
| --- | --- | --- | --- |
| `reading` | `read` | `Read` | Gates that must only read supplied artifacts. |
| `authoring` | `read`, `write` | `Read`, `Write` | Planners, verifiers, generators, copywriter — read inputs, write one artifact. |
| `researching` | `read`, `write`, `web_search`, `browser` | `Read`, `Write`, `WebSearch`, `WebFetch` | The two web-facing agents (research scout, visual researcher). |

Restricting gates to `reading` is a correctness device, not just economy: a gate that cannot write cannot "helpfully" edit the artifact it is judging.

## Agent catalog

| Agent | Role | Toolset | Chart states | Purpose |
| --- | --- | --- | --- | --- |
| `report-engine-research-scout` | worker | researching | `initial-research.*`, `deep-research.scout` | Structured web research: initial angle scans and deep takes, hard-capped by evidence depth. |
| `report-engine-planner` | planner | authoring | `plan-research`, `evidence-register-review`, `narrative-strategy`, `beat-patch` | Deep planning: skeleton + agenda, narrative strategy, register review, evidence micro-patches. |
| `report-engine-research-gate` | research-reviewer | reading | `deep-research.gate` | Per-take semantic gate; returns the smallest missing-evidence delta, never rereads the corpus. |
| `report-engine-plan-gate` | reviewer | reading | `strategy-gate` | Low-context semantic gate for the narrative strategy. |
| `report-engine-section-beat-planner` | planner | authoring | `section-beats.generate` | Generates/repairs one section of the stable beat candidate in parallel. |
| `report-engine-beat-verifier` | reviewer | authoring | `verify-beats.verify` | Verifies one frozen beat against its evidence packet; emits a verdict-only artifact. |
| `report-engine-layout-planner` | planner | authoring | `experience-plan` | The single global editorial/visual experience pass. |
| `report-engine-chapter-planner` | planner | authoring | `plan-chapter` | Plans one atomic chapter and its concrete lazy visual requests. |
| `report-engine-visual-researcher` | worker | researching | `visual-inputs.acquire` | Lazy acquisition of one dataset/image per validated request. |
| `report-engine-visual-gate` | reviewer | reading | `visual-inputs.gate` | Per-input usability gate with minimal acquisition deltas. |
| `report-engine-element-generator` | worker | authoring | `generate-elements`, `element-patch` | Typed editorial + chart-semantic blocks for one chapter; bounded fallback patches. |
| `report-engine-copywriter` | worker | authoring | `copywrite` | Evidence-led prose, one module per verified beat. |
| `report-engine-manuscript-gate` | reviewer | reading | `manuscript-gate` | Whole-manuscript review with owner-routed (`layout`/`elements`/`copy`) rework instructions. |
| `report-engine-visual-qa` | reviewer | authoring | `visual-qa` | Screenshot-only QA; separates chapter rework from engine warnings. |

## Configuring the mappings

Role and toolset mappings live in the Hyperchart host settings, resolved per state as: chart-level override → configured role/toolset from `settings.json` → agent frontmatter fallback (none in Odyssey) → host default model. Settings scopes, most specific first: project chart directory → shared `<repo>/.hypercharts/` → host user directory (e.g. `~/.pi/agent/hypercharts/`, `~/.claude/hypercharts/`).

A settings file can be flat (single-host) or carry per-host sections:

```json
{
  "pi": {
    "roles": {
      "planner": "openai-codex/gpt-5.6-luna",
      "research-reviewer": "openai-codex/gpt-5.6-luna",
      "reviewer": "openai-codex/gpt-5.6-sol",
      "worker": "deepseek/deepseek-v4-pro"
    },
    "toolsets": {
      "reading": ["read"],
      "authoring": ["read", "write"],
      "researching": ["read", "write", "web_search", "browser"]
    }
  },
  "claude": {
    "roles": {
      "planner": "claude-opus-4-8",
      "research-reviewer": "claude-sonnet-4-5",
      "reviewer": "claude-opus-4-8",
      "worker": "claude-haiku-4-5"
    },
    "toolsets": {
      "reading": ["Read"],
      "authoring": ["Read", "Write"],
      "researching": ["Read", "Write", "WebSearch", "WebFetch"]
    }
  }
}
```

Mapping guidance from real runs: keep `planner` on the strongest available tier — planning failures are the most expensive to discover (they surface many states later); `worker` tolerates the cheapest capable tier because guards and gates catch its mistakes locally; `research-reviewer` exists precisely so the highest-volume gate doesn't run on reviewer-tier pricing.
