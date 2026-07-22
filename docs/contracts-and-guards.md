# Contracts, guards, and artifacts

## Contracts (`contracts/`)

- `index.ts` — every artifact and reply schema as Zod, with inferred TypeScript types. Schemas come in pairs: the base schema (e.g. `NarrativeStrategy`) and a registered `…Output` runtime contract (e.g. `NarrativeStrategyOutput`) used by the chart for replies and shaped artifacts. Registration is enforced at runtime by the hyperchart schema registry, and the mock run (`tests/mock-run.test.ts`) executes the whole chart against that registry — a state with an unregistered or mismatched contract fails the run.
- `constants.ts` — the two knob tables, single source of truth for every cap ([running.md](running.md#arguments)): `RESEARCH_CAPS` (per-depth take counts and per-take source/finding caps) and `PRODUCTION_CAPS` (per-polish rewrite and QA budgets).
- `runtime.ts` — parsing helpers (`parseJsonFile`, `parseJsonText`, `requiredEnv`, `emit`, `writeJsonArtifact`) that turn Zod failures into actionable, path-qualified error messages.

Zod owns structural validation and *same-artifact* invariants: URL protocols, unique IDs, non-empty claims, evidence/source referential integrity within one document, conditional requirements (an `image` input must have `image.localPath`, etc.). Anything the type system can enforce is enforced here, before any guard runs.

## Validation layers

Every agent output passes through up to four layers, cheapest first:

1. **Zod contracts** — structure and local invariants, at parse time.
2. **Deterministic guards** (`guards/`, run as the state's `validate` script) — cross-artifact and filesystem checks: does the artifact agree with the inputs the agent was given, with the evidence index, with the caps?
3. **Semantic agent gates** — judgment calls no script can make (is this take good enough? is the strategy sound? is the chart readable?). Gates are separate `reading`-toolset agents, so they can't edit what they judge.
4. **Deterministic budgets** — scripts that bound every retry loop and decide between "one more round with feedback" and "proceed with a recorded warning" (or fail closed where correctness demands it).

## Guard-writing rules

Guards talk to a retrying agent, and the message *is* the interface. These rules are load-bearing — violating the first two once cost a full run (agents "fixed" the wrong field until retries were exhausted):

1. **Report every violation in one pass.** Collect all reasons and return the full list (`element-checks.ts` returns `{kind, reasons: string[]}`); one-error-at-a-time turns a two-retry budget into a death by paper cuts.
2. **Name the exact field and the required value.** "beat b3 must set guaranteedUse: true" gets fixed on the next attempt; "beat b3 has an invalid visual configuration" gets the wrong field edited. Never merge unrelated conditions into one message.
3. **Validate against what the agent actually saw.** Guards receive the same packet/work-item paths as the agent (via env), not a broader corpus, so feedback is always actionable within the agent's context.
4. **Exit codes carry the verdict, stdout carries the feedback.** Guards emit a typed `PlanGateFeedback` reply (`{reason, instructions[]}`) that the runtime feeds back into the retry prompt.

## Guard inventory

| Guard | Validates | Against |
| --- | --- | --- |
| `validate-depth-agenda.ts` | Deep-research agenda | Depth caps (take count, per-take budgets) + skeleton coverage tags. |
| `validate-take.ts` | One deep-research take | Expected take ID + per-take source/finding caps for the depth. |
| `validate-evidence-register-patch.ts` | Register review patch | ≤ 8 ops, immutable IDs/descriptions, cited evidence IDs exist. |
| `validate-strategy.ts` | Narrative strategy | Evidence index (allocations reference real evidence, sections coherent). |
| `validate-section-beats.ts` | One section's beat draft | Its work item (section identity, repair-mode preservation). |
| `validate-verified-beat.ts` | One beat verdict | Its evidence packet (matching beat ID, evidenceIds ⊆ packet). |
| `validate-experience.ts` | Experience plan | Strategy + beat candidate + evidence index. |
| `validate-chapter-plan.ts` | One chapter plan | Work item + evidence index: per-beat `inline`/`dataset-backed` mode, `guaranteedUse: true` on every intent, requests only for dataset-backed beats with real evidence IDs and a fallback, budget respected. |
| `validate-visual-input.ts` | One acquired visual input | Its request packet: `s_`-prefixed sourceIds only, provenance evidence IDs valid, status/fallback consistency. Also persists its feedback to a file so the retry budget can merge guard and gate deltas. |
| `element-checks.ts` | (library) full element-package check | Work item, chapter plan, visual catalog: block schema, budget arithmetic, request/evidence references. Returns all reasons plus a `patch-required` vs `invalid` classification. |
| `validate-elements.ts` | Standalone entry over `element-checks` | Used by tests/fixtures; at runtime the check runs inside `scripts/route-elements.ts` to route valid / patchable / regenerate. |
| `validate-chapter.ts` | One written chapter | Its element package + work item: module per verified beat, evidence IDs preserved, clean handoff. |
| `runtime.ts` | (library) | Shared guard helpers (`errorMessage`, reporting). |

Deterministic checks that *route* rather than reject live in `scripts/` (`route-beats.ts` — beat topology triage with cycle detection, `route-elements.ts`, `check-closure.ts`, `validate-render.ts`).

## Artifact map

Everything a run produces lives under `artifacts/` (gitignored). Versioned names (`-<attempt>`) keep every retry inspectable; stable names hold the current accepted version.

```text
artifacts/
├─ research/
│  ├─ initial/{landscape,evidence,tensions}.json      # 3 initial scans
│  ├─ narrative-skeleton.json                         # provisional skeleton
│  ├─ deep-research-agenda.json                       # takes to research
│  ├─ deep/<takeId>/research-<attempt>.json           # versioned take artifacts
│  ├─ evidence-register-patch-<n>.json                # register review patches
│  └─ evidence-index.json                             # THE immutable evidence index
├─ plan/
│  ├─ strategy-<n>.json                               # versioned narrative strategy
│  ├─ section-beat-work-<n>.json                      # per-section work items
│  ├─ section-beats/<sectionId>-<n>.json              # parallel section drafts
│  ├─ beats-candidate.json (+ -assembled-<n>/-patched-<n> snapshots)
│  ├─ beat-patch-<n>.json                             # evidence micro-patches
│  ├─ beat-items-<n>.json + beat-packets-<n>/         # frozen beats + evidence packets
│  ├─ verified-beats/<beatId>-<n>.json                # per-beat verdicts
│  ├─ report-plan-<n>.json                            # assembled verified plan
│  └─ closure-review.json
├─ write/
│  ├─ experience-<n>.json                             # global experience plan
│  ├─ chapter-work.json / chapter-rework.json         # chapter work items
│  ├─ chapters/<sectionId>/
│  │  ├─ chapter-plan.json
│  │  ├─ visual-packets/ + visual-work.json
│  │  ├─ visual-inputs/<requestId>-<attempt>.json
│  │  ├─ visual-inputs.json                           # assembled chapter catalog
│  │  ├─ elements.json (+ element-patch-<n>.json)
│  │  └─ chapter.json                                 # written chapter package
│  ├─ report-document.json                            # assembled ReportDocument
│  ├─ render-review.json / render-validation.json
│  ├─ screenshots/ + screenshots.json
│  └─ visual-qa-<n>.json / visual-qa-warnings.json
└─ report.html                                        # the final report
```
