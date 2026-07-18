import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	agent,
	artifact,
	chart,
	compound,
	final,
	json,
	map,
	parallel,
	refs,
	resume,
	script,
	t,
	z,
} from "@surprisal/hyperchart";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const workflowFile = (path: string) => resolve(workflowDir, path);

import {
	BeatDraft,
	BeatItems,
	type BeatWorkItem,
	ChapterPlan,
	DeepResearch,
	DeepResearchAgenda,
	type DeepResearchTake,
	DocumentManifest,
	ElementPackage,
	EvidenceIndex,
	EvidenceManifest,
	ExperiencePlan,
	GateFeedback,
	InitialResearch,
	ManuscriptGateFeedback,
	NarrativeStrategy,
	PlanGateFeedback,
	PlanManifest,
	RenderManifest,
	RenderReview,
	RenderValidation,
	ReportDocument,
	ReportPlan,
	ScreenshotManifest,
	SectionPackage,
	SectionWorkItem,
	SectionWorkItems,
	TakeManifest,
	VerifiedBeat,
	VisualCatalog,
	VisualInput,
	type VisualRequest,
	VisualWarnings,
} from "./contracts/index.js";

type Args = { prompt: string };

type Results = {
	"research.plan-deep-research": z.infer<typeof DeepResearchAgenda>;
	"research.deep-research.scout": z.infer<typeof TakeManifest>;
	"research.deep-research.gate": z.infer<typeof GateFeedback>;
	"research.assemble-evidence": z.infer<typeof EvidenceManifest>;
	"plan.validate-strategy": z.infer<typeof PlanGateFeedback>;
	"plan.strategy-gate": z.infer<typeof PlanGateFeedback>;
	"plan.validate-beats": z.infer<typeof PlanGateFeedback>;
	"plan.prepare-beats": z.infer<typeof BeatItems>;
	"plan.verify-beats.validate": z.infer<typeof PlanGateFeedback>;
	"plan.assemble-plan": z.infer<typeof PlanManifest>;
	"plan.plan-gate": z.infer<typeof PlanGateFeedback>;
	"write.experience-plan": z.infer<typeof ExperiencePlan>;
	"write.validate-experience": z.infer<typeof PlanGateFeedback>;
	"write.prepare-chapter-work": z.infer<typeof SectionWorkItems>;
	"write.chapter-production.route": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.plan-chapter": z.infer<typeof ChapterPlan>;
	"write.chapter-production.visual-inputs.validate": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.visual-inputs.gate": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.visual-inputs.retry-budget": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.validate-elements": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.validate-chapter": z.infer<typeof PlanGateFeedback>;
	"write.assemble-document": z.infer<typeof DocumentManifest>;
	"write.manuscript-gate": z.infer<typeof ManuscriptGateFeedback>;
	"write.manuscript-rewrite-budget": z.infer<typeof ManuscriptGateFeedback>;
	"write.route-chapter-rework": z.infer<typeof SectionWorkItems>;
	"write.render-html": z.infer<typeof RenderManifest>;
	"write.validate-render": z.infer<typeof RenderValidation>;
	"write.screenshot-report": z.infer<typeof ScreenshotManifest>;
	"write.visual-qa": z.infer<typeof ManuscriptGateFeedback>;
	"write.visual-rewrite-budget": z.infer<typeof ManuscriptGateFeedback>;
};

type Files = {
	"research.initial-research.landscape.scout": { research: z.infer<typeof InitialResearch> };
	"research.initial-research.evidence.scout": { research: z.infer<typeof InitialResearch> };
	"research.initial-research.tensions.scout": { research: z.infer<typeof InitialResearch> };
	"research.plan-deep-research": { agenda: z.infer<typeof DeepResearchAgenda> };
	"research.deep-research.scout": { research: z.infer<typeof DeepResearch> };
	"research.assemble-evidence": { evidence: z.infer<typeof EvidenceIndex> };
	"plan.narrative-strategy": { strategy: z.infer<typeof NarrativeStrategy> };
	"plan.draft-beats": { beats: z.infer<typeof BeatDraft> };
	"plan.prepare-beats": { items: z.infer<typeof BeatItems> };
	"plan.verify-beats.verify": { verified: z.infer<typeof VerifiedBeat> };
	"plan.assemble-plan": { plan: z.infer<typeof ReportPlan> };
	"write.experience-plan": { experience: z.infer<typeof ExperiencePlan> };
	"write.prepare-chapter-work": { work: z.infer<typeof SectionWorkItems> };
	"write.chapter-production.plan-chapter": { plan: z.infer<typeof ChapterPlan> };
	"write.chapter-production.visual-inputs.acquire": { input: z.infer<typeof VisualInput> };
	"write.chapter-production.assemble-visual-inputs": { catalog: z.infer<typeof VisualCatalog> };
	"write.chapter-production.generate-elements": { elements: z.infer<typeof ElementPackage> };
	"write.chapter-production.copywrite": { section: z.infer<typeof SectionPackage> };
	"write.route-chapter-rework": { work: z.infer<typeof SectionWorkItems> };
	"write.assemble-document": { document: z.infer<typeof ReportDocument> };
	"write.render-html": { report: unknown };
	"write.validate-render": { review: z.infer<typeof RenderReview> };
	"write.screenshot-report": { screenshots: z.infer<typeof ScreenshotManifest> };
	"write.visual-qa": { review: z.infer<typeof ManuscriptGateFeedback> };
	"write.finalize-visual-warnings": { warnings: z.infer<typeof VisualWarnings> };
};

type Maps = {
	"research.deep-research": z.infer<typeof DeepResearchTake>;
	"plan.verify-beats": z.infer<typeof BeatWorkItem>;
	"write.chapter-production": z.infer<typeof SectionWorkItem>;
	"write.chapter-production.visual-inputs": z.infer<typeof VisualRequest>;
};

type Inputs = {
	"research.deep-research.scout": { feedback: z.infer<typeof GateFeedback> };
	"plan.narrative-strategy": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.draft-beats": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.verify-beats.verify": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.experience-plan": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production": { items: Record<string, z.infer<typeof SectionWorkItem>> };
	"write.chapter-production.visual-inputs.acquire": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.visual-inputs.retry-budget": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.generate-elements": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.copywrite": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.manuscript-rewrite-budget": { feedback: z.infer<typeof ManuscriptGateFeedback> };
	"write.route-chapter-rework": { feedback: z.infer<typeof ManuscriptGateFeedback> };
	"write.visual-rewrite-budget": { feedback: z.infer<typeof ManuscriptGateFeedback> };
	"write.finalize-visual-warnings": { feedback: z.infer<typeof ManuscriptGateFeedback> };
};

const {
	arg,
	artifactOf,
	event,
	input,
	item,
	joinArtifactOf,
	key,
	result,
	visit: visitRef,
} = refs<Args, Results, Files, Maps, Inputs>();

const emptyResearchFeedback = {
	reason: "",
	missingEvidence: [],
	followupQueries: [],
	preserveFindings: [],
};
const emptyPlanFeedback = { reason: "", instructions: [] };

export default chart({
	kind: "chart",
	id: "odyssey",
	initial: "research",
	states: {
		research: compound({
			initial: "initial-research",
			states: {
				"initial-research": parallel({
					states: {
						landscape: compound({
							initial: "scout",
							states: {
								scout: {
									kind: "state",
									action: agent("report-engine-research-scout", {
										task: t`Run a bounded initial research pass for this request:\n\n${arg("prompt")}\n\nAngle: Landscape — definitions, current state, key actors, timeline, and strong primary or overview sources. Build context only; do not deep-dive or create a report outline. Write the declared artifact with angleId "landscape" and finish with SCOUTED.`,
										artifacts: { research: artifact("artifacts/research/initial/landscape.json", InitialResearch) },
									}),
									transitions: { SCOUTED: "done" },
								},
								done: final(),
							},
						}),
						evidence: compound({
							initial: "scout",
							states: {
								scout: {
									kind: "state",
									action: agent("report-engine-research-scout", {
										task: t`Run a bounded initial research pass for this request:\n\n${arg("prompt")}\n\nAngle: Evidence and mechanics — measurable facts, mechanisms, causal claims, primary data, and concrete examples. Separate supported mechanisms from assumptions. Do not deep-dive or create a report outline. Write the declared artifact with angleId "evidence" and finish with SCOUTED.`,
										artifacts: { research: artifact("artifacts/research/initial/evidence.json", InitialResearch) },
									}),
									transitions: { SCOUTED: "done" },
								},
								done: final(),
							},
						}),
						tensions: compound({
							initial: "scout",
							states: {
								scout: {
									kind: "state",
									action: agent("report-engine-research-scout", {
										task: t`Run a bounded initial research pass for this request:\n\n${arg("prompt")}\n\nAngle: Tensions and implications — credible disagreement, risks, trade-offs, alternatives, consequences, and unresolved questions. Build context only; do not deep-dive or create a report outline. Write the declared artifact with angleId "tensions" and finish with SCOUTED.`,
										artifacts: { research: artifact("artifacts/research/initial/tensions.json", InitialResearch) },
									}),
									transitions: { SCOUTED: "done" },
								},
								done: final(),
							},
						}),
					},
					onDone: "plan-deep-research",
				}),

				"plan-deep-research": {
					kind: "state",
					action: agent("report-engine-planner", {
						task: t`Plan focused deep research for this request:\n\n${arg("prompt")}\n\nRead the three initial-research artifacts. Produce exactly as many atomic, non-overlapping, independently executable takes as the evidence gaps require. Write the agenda and finish with DEEP_RESEARCH_PLANNED using the same agenda as structured output.`,
						reads: [
							artifactOf("research.initial-research.landscape.scout"),
							artifactOf("research.initial-research.evidence.scout"),
							artifactOf("research.initial-research.tensions.scout"),
						],
						artifacts: { agenda: artifact("artifacts/research/deep-research-agenda.json", DeepResearchAgenda) },
						reply: DeepResearchAgenda,
					}),
					transitions: { DEEP_RESEARCH_PLANNED: "deep-research" },
				},

				"deep-research": map({
					over: result("research.plan-deep-research", "takes"),
					concurrency: 4,
					initial: "scout",
					states: {
						scout: {
							kind: "state",
							input: { feedback: GateFeedback.default(emptyResearchFeedback) },
							onReenter: resume(
								t`Preserve accepted findings and address only this gate delta: ${json(input("feedback"))}. Write the complete revised artifact to artifacts/research/deep/${key("research.deep-research")}/research-${visitRef("research.deep-research.scout")}.json, then finish with SCOUTED and output the refreshed manifest.`,
							),
							action: agent("report-engine-research-scout", {
								task: t`Research one deep take for this request:\n\n${arg("prompt")}\n\nTake key: ${key("research.deep-research")}\nTake: ${json(item("research.deep-research"))}\nAttempt: ${visitRef("research.deep-research.scout")}\nGate feedback: ${json(input("feedback"))}\n\nWrite a complete versioned artifact to artifacts/research/deep/${key("research.deep-research")}/research-${visitRef("research.deep-research.scout")}.json. Finish with SCOUTED and output {takeId, artifactPath, sourceCount, evidenceCount}.`,
								artifacts: {
									research: artifact(
										t`artifacts/research/deep/${key("research.deep-research")}/research-${visitRef("research.deep-research.scout")}.json`,
										DeepResearch,
									),
								},
								reply: TakeManifest,
							}),
							validate: script("tsx", [workflowFile("guards/validate-take.ts")]),
							onReject: "resume",
							retries: 2,
							transitions: { SCOUTED: "gate" },
						},
						gate: {
							kind: "state",
							action: agent("report-engine-research-gate", {
								task: t`Gate one deep-research take.\n\nTake: ${json(item("research.deep-research"))}\nAttempt: ${visitRef("research.deep-research.scout")}\n\nRead only the supplied artifact. PASS when acceptance criteria are materially satisfied. BLOCK only for consequential missing evidence and return the smallest delta.`,
								reads: [artifactOf("research.deep-research.scout")],
								reply: GateFeedback,
							}),
							transitions: {
								PASS: "done",
								BLOCK: { target: "scout", input: { feedback: event() } },
							},
						},
						done: final(),
					},
					onDone: "assemble-evidence",
				}),

				"assemble-evidence": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/assemble-evidence.ts")], {
						env: {
							TAKE_FILES: joinArtifactOf("research.deep-research.scout"),
							OUTPUT_PATH: "artifacts/research/evidence-index.json",
						},
						artifacts: { evidence: artifact("artifacts/research/evidence-index.json", EvidenceIndex) },
						reply: EvidenceManifest,
					}),
					transitions: { EVIDENCE_READY: "done" },
				},
				done: final(),
			},
			transitions: { FAILED: "failed" },
			onDone: "plan",
		}),

		plan: compound({
			initial: "narrative-strategy",
			states: {
				"narrative-strategy": {
					kind: "state",
					input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
					onReenter: resume(
						t`Revise only the narrative strategy using this gate feedback: ${json(input("feedback"))}. Write the complete revised strategy to artifacts/plan/strategy-${visitRef("plan.narrative-strategy")}.json, then finish with STRATEGY_READY.`,
					),
					action: agent("report-engine-planner", {
						task: t`Create an evidence-led narrative strategy for this report request:\n\n${arg("prompt")}\n\nGate feedback: ${json(input("feedback"))}\n\nRead the immutable evidence index. Define one supportable thesis, reader question, ordered sections, evidence allocation, exclusions, and style notes. Do not draft beats or prose. Write to artifacts/plan/strategy-${visitRef("plan.narrative-strategy")}.json, then finish with STRATEGY_READY.`,
						reads: [artifactOf("research.assemble-evidence")],
						artifacts: {
							strategy: artifact(
								t`artifacts/plan/strategy-${visitRef("plan.narrative-strategy")}.json`,
								NarrativeStrategy,
							),
						},
					}),
					transitions: { STRATEGY_READY: "validate-strategy" },
				},

				"validate-strategy": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/validate-strategy.ts")], {
						env: {
							STRATEGY_FILE: artifactOf("plan.narrative-strategy"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
						},
						reply: PlanGateFeedback,
					}),
					transitions: {
						STRATEGY_VALID: "strategy-gate",
						STRATEGY_INVALID: { target: "narrative-strategy", input: { feedback: event() } },
					},
				},

				"strategy-gate": {
					kind: "state",
					action: agent("report-engine-plan-gate", {
						task: "Strategy-gate mode. Review the proposed strategy against the supplied evidence index. Finish with STRATEGY_PASS when thesis, reader question, section progression, evidence allocation, and exclusions are sound. Finish with STRATEGY_BLOCK only for consequential problems. Return {reason,instructions}.",
						reads: [artifactOf("plan.narrative-strategy"), artifactOf("research.assemble-evidence")],
						reply: PlanGateFeedback,
					}),
					transitions: {
						STRATEGY_PASS: "draft-beats",
						STRATEGY_BLOCK: { target: "narrative-strategy", input: { feedback: event() } },
					},
				},

				"draft-beats": {
					kind: "state",
					input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
					onReenter: "restart",
					action: agent("report-engine-planner", {
						task: t`Draft evidence-backed narrative beats for this report request:\n\n${arg("prompt")}\n\nGate feedback: ${json(input("feedback"))}\n\nRead the authoritative evidence index and current strategy supplied with this action. Produce ordered atomic beats: one takeaway, one narrative purpose, one existing section, and only valid evidence IDs per beat. Write to artifacts/plan/beats-${visitRef("plan.draft-beats")}.json and finish with BEATS_READY.`,
						reads: [artifactOf("research.assemble-evidence"), artifactOf("plan.narrative-strategy")],
						artifacts: {
							beats: artifact(t`artifacts/plan/beats-${visitRef("plan.draft-beats")}.json`, BeatDraft),
						},
					}),
					transitions: { BEATS_READY: "validate-beats" },
				},

				"validate-beats": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/validate-beats.ts")], {
						env: {
							DRAFT_FILE: artifactOf("plan.draft-beats"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							STRATEGY_FILE: artifactOf("plan.narrative-strategy"),
						},
						reply: PlanGateFeedback,
					}),
					transitions: {
						BEATS_VALID: "prepare-beats",
						BEATS_INVALID: { target: "draft-beats", input: { feedback: event() } },
					},
				},

				"prepare-beats": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/prepare-beats.ts")], {
						env: {
							DRAFT_FILE: artifactOf("plan.draft-beats"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							STRATEGY_FILE: artifactOf("plan.narrative-strategy"),
							OUTPUT_PATH: t`artifacts/plan/beat-items-${visitRef("plan.prepare-beats")}.json`,
							PACKET_DIR: t`artifacts/plan/beat-packets-${visitRef("plan.prepare-beats")}`,
						},
						artifacts: {
							items: artifact(t`artifacts/plan/beat-items-${visitRef("plan.prepare-beats")}.json`, BeatItems),
						},
						reply: BeatItems,
					}),
					transitions: { BEAT_ITEMS_READY: "verify-beats" },
				},

				"verify-beats": map({
					over: result("plan.prepare-beats", "items"),
					concurrency: 4,
					initial: "verify",
					states: {
						verify: {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							onReenter: "restart",
							action: agent("report-engine-beat-verifier", {
								task: t`Verify one narrative beat against its compact evidence packet.\n\nBeat: ${json(item("plan.verify-beats"))}\nValidation feedback: ${json(input("feedback"))}\n\nWrite the verification artifact to artifacts/plan/verified-beats/${key("plan.verify-beats")}-${visitRef("plan.verify-beats.verify")}.json. Preserve id, index, sectionId, and narrativePurpose. Finish with VERIFIED.`,
								reads: [t`${item("plan.verify-beats", "packetPath")}`],
								artifacts: {
									verified: artifact(
										t`artifacts/plan/verified-beats/${key("plan.verify-beats")}-${visitRef("plan.verify-beats.verify")}.json`,
										VerifiedBeat,
									),
								},
							}),
							transitions: { VERIFIED: "validate" },
						},
						validate: {
							kind: "state",
							action: script("tsx", [workflowFile("scripts/validate-verified-beat.ts")], {
								env: {
									VERIFIED_FILE: artifactOf("plan.verify-beats.verify"),
									PACKET_FILE: t`${item("plan.verify-beats", "packetPath")}`,
								},
								reply: PlanGateFeedback,
							}),
							transitions: {
								VERIFICATION_VALID: "done",
								VERIFICATION_INVALID: { target: "verify", input: { feedback: event() } },
							},
						},
						done: final(),
					},
					onDone: "assemble-plan",
				}),

				"assemble-plan": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/assemble-plan.ts")], {
						env: {
							STRATEGY_FILE: artifactOf("plan.narrative-strategy"),
							BEAT_ITEMS_FILE: artifactOf("plan.prepare-beats"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							VERIFIED_FILES: joinArtifactOf("plan.verify-beats.verify"),
							OUTPUT_PATH: t`artifacts/plan/report-plan-${visitRef("plan.assemble-plan")}.json`,
						},
						artifacts: {
							plan: artifact(t`artifacts/plan/report-plan-${visitRef("plan.assemble-plan")}.json`, ReportPlan),
						},
						reply: PlanManifest,
					}),
					transitions: { PLAN_ASSEMBLED: "plan-gate" },
				},

				"plan-gate": {
					kind: "state",
					action: agent("report-engine-plan-gate", {
						task: "Final-coherence mode. Review only the assembled report plan under its already-approved strategy. Finish with PASS when verified beats are coherent, non-redundant, well ordered, and sufficiently connected. Use REPLAN_BEATS only for specific beat-set problems. Return {reason,instructions}. Never request strategy replanning here.",
						reads: [artifactOf("plan.assemble-plan")],
						reply: PlanGateFeedback,
					}),
					transitions: {
						PASS: "done",
						REPLAN_BEATS: { target: "draft-beats", input: { feedback: event() } },
					},
				},
				done: final(),
			},
			transitions: { FAILED: "failed" },
			onDone: "write",
		}),

		write: compound({
			initial: "experience-plan",
			states: {
				"experience-plan": {
					kind: "state",
					input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
					onReenter: "restart",
					action: agent("report-engine-layout-planner", {
						task: t`Create the global editorial and visual experience plan for this report:\n\n${arg("prompt")}\n\nFeedback: ${json(input("feedback"))}\n\nRead the verified report plan and evidence index. Allocate prose versus visual anchors across the whole report, define chapter rhythm, visual budgets, beat presentation roles, high-level visual intent, and preferred outputs. Do not create concrete visual requests; each atomic chapter planner will do that later. Do not write prose, block payloads, HTML, CSS, JavaScript, or raw ECharts options. Write the declared versioned artifact and finish with EXPERIENCE_READY using the same plan as structured output.`,
						reads: [artifactOf("plan.assemble-plan"), artifactOf("research.assemble-evidence")],
						artifacts: {
							experience: artifact(
								t`artifacts/write/experience-${visitRef("write.experience-plan")}.json`,
								ExperiencePlan,
							),
						},
						reply: ExperiencePlan,
					}),
					transitions: { EXPERIENCE_READY: "validate-experience" },
				},
				"validate-experience": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/validate-experience.ts")], {
						env: {
							PLAN_FILE: artifactOf("plan.assemble-plan"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							EXPERIENCE_FILE: artifactOf("write.experience-plan"),
						},
						reply: PlanGateFeedback,
					}),
					transitions: {
						EXPERIENCE_VALID: "prepare-chapter-work",
						EXPERIENCE_INVALID: { target: "experience-plan", input: { feedback: event() } },
					},
				},
				"prepare-chapter-work": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/prepare-chapter-work.ts")], {
						env: {
							PLAN_FILE: artifactOf("plan.assemble-plan"),
							EXPERIENCE_FILE: artifactOf("write.experience-plan"),
							OUTPUT_PATH: "artifacts/write/chapter-work.json",
						},
						artifacts: { work: artifact("artifacts/write/chapter-work.json", SectionWorkItems) },
						reply: SectionWorkItems,
					}),
					transitions: { CHAPTER_WORK_READY: { target: "chapter-production", input: { items: event("items") } } },
				},
				"chapter-production": map({
					input: { items: z.record(z.string(), SectionWorkItem) },
					over: input("items"),
					concurrency: 4,
					initial: "route",
					states: {
						route: {
							kind: "state",
							action: script("tsx", [workflowFile("scripts/route-chapter-start.ts")], {
								env: { WORK_JSON: t`${json(item("write.chapter-production"))}` },
								reply: PlanGateFeedback,
							}),
							transitions: {
								START_LAYOUT: "plan-chapter",
								START_ELEMENTS: "generate-elements",
								START_COPY: "copywrite",
							},
						},
						"plan-chapter": {
							kind: "state",
							onReenter: resume(
								t`Patch the current chapter plan in place instead of replanning from scratch. Current work item and cumulative manuscript feedback: ${json(item("write.chapter-production"))}. Preserve accepted requests and constraints, modify only the requested layout/visual decisions, stay within verified beat evidence IDs and declared outputs, and finish with CHAPTER_PLANNED using the complete updated plan.`,
							),
							action: agent("report-engine-chapter-planner", {
								task: t`Plan one atomic chapter and its concrete lazy visual requests.\n\nWork item: ${json(item("write.chapter-production"))}\n\nRead the evidence index. Follow the global experience direction, but decide visual requests only for this chapter. Every request must serve one verified beat, cite existing evidence IDs, and include a fallback. Do not write prose, acquire assets, generate blocks, or affect other chapters. Write the declared chapter plan and finish with CHAPTER_PLANNED using the same plan as structured output.`,
								reads: [artifactOf("research.assemble-evidence")],
								artifacts: { plan: artifact(t`${item("write.chapter-production", "chapterPlanPath")}`, ChapterPlan) },
								reply: ChapterPlan,
							}),
							transitions: { CHAPTER_PLANNED: "visual-inputs" },
						},
						"visual-inputs": map({
							over: result("write.chapter-production.plan-chapter", "visualRequests"),
							concurrency: 3,
							initial: "acquire",
							states: {
								acquire: {
									kind: "state",
									input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
									onReenter: "restart",
									action: agent("report-engine-visual-researcher", {
										task: t`Acquire exactly one visual input lazily for one chapter.\n\nChapter: ${key("write.chapter-production")}\nRequest: ${json(item("write.chapter-production.visual-inputs"))}\nAttempt: ${visitRef("write.chapter-production.visual-inputs.acquire")} of 2\nFeedback: ${json(input("feedback"))}\n\nStart from evidence-linked source URLs and search beyond them only for missing input. Do not introduce unsupported claims. The output sourceIds array MUST contain source-record IDs with the s_ prefix from evidence-index.sources, never evidence/claim IDs with the e_ prefix. Evidence IDs belong only in dataset.provenance[].evidenceId. Write the declared artifact and finish with ACQUIRED; use status not-found plus fallback when acquisition fails.`,
										reads: [artifactOf("research.assemble-evidence")],
										artifacts: {
											input: artifact(
												t`artifacts/write/chapters/${key("write.chapter-production")}/visual-inputs/${key("write.chapter-production.visual-inputs")}-${visitRef("write.chapter-production.visual-inputs.acquire")}.json`,
												VisualInput,
											),
										},
									}),
									transitions: { ACQUIRED: "validate" },
								},
								validate: {
									kind: "state",
									action: script("tsx", [workflowFile("scripts/validate-visual-input.ts")], {
										env: {
											REQUEST_JSON: t`${json(item("write.chapter-production.visual-inputs"))}`,
											INPUT_FILE: artifactOf("write.chapter-production.visual-inputs.acquire"),
											EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
										},
										reply: PlanGateFeedback,
									}),
									transitions: {
										VISUAL_INPUT_VALID: "gate",
										VISUAL_INPUT_INVALID: { target: "retry-budget", input: { feedback: event() } },
									},
								},
								gate: {
									kind: "state",
									action: agent("report-engine-visual-gate", {
										task: t`Review one acquired visual input against this chapter request: ${json(item("write.chapter-production.visual-inputs"))}. PASS when usable, FALLBACK when an honest not-found result should use its fallback, or BLOCK with a minimal acquisition delta.`,
										reads: [artifactOf("write.chapter-production.visual-inputs.acquire")],
										reply: PlanGateFeedback,
									}),
									transitions: {
										PASS: "done",
										FALLBACK: "done",
										BLOCK: { target: "retry-budget", input: { feedback: event() } },
									},
								},
								"retry-budget": {
									kind: "state",
									input: { feedback: PlanGateFeedback },
									action: script("tsx", [workflowFile("scripts/visual-input-retry-budget.ts")], {
										env: {
											ATTEMPT: t`${visitRef("write.chapter-production.visual-inputs.acquire")}`,
											REQUEST_JSON: t`${json(item("write.chapter-production.visual-inputs"))}`,
											INPUT_FILE: artifactOf("write.chapter-production.visual-inputs.acquire"),
											FEEDBACK_JSON: t`${json(input("feedback"))}`,
										},
										reply: PlanGateFeedback,
									}),
									transitions: { RETRY: { target: "acquire", input: { feedback: event() } }, FALLBACK: "done" },
								},
								done: final(),
							},
							onDone: "assemble-visual-inputs",
						}),
						"assemble-visual-inputs": {
							kind: "state",
							action: script("tsx", [workflowFile("scripts/assemble-chapter-visual-inputs.ts")], {
								env: {
									SECTION_ID: t`${item("write.chapter-production", "sectionId")}`,
									VISUAL_FILES: joinArtifactOf("write.chapter-production.visual-inputs.acquire"),
									OUTPUT_PATH: t`${item("write.chapter-production", "visualCatalogPath")}`,
								},
								artifacts: {
									catalog: artifact(t`${item("write.chapter-production", "visualCatalogPath")}`, VisualCatalog),
								},
							}),
							transitions: { VISUAL_INPUTS_READY: "generate-elements" },
						},
						"generate-elements": {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							onReenter: resume(
								t`Patch the current element package in place instead of regenerating it. Current work item and cumulative manuscript feedback: ${json(item("write.chapter-production"))}. Latest deterministic feedback: ${json(input("feedback"))}. Preserve every previously accepted correction. Change only the named blocks/fields, stay within the verified beat evidence IDs and declared block schema, and finish with ELEMENTS_READY.`,
							),
							action: agent("report-engine-element-generator", {
								task: t`Generate the semantic visual element package for one atomic chapter.\n\nWork item: ${json(item("write.chapter-production"))}\nFeedback: ${json(input("feedback"))}\n\nRead the current chapter plan and validated chapter-local visual catalog. Follow the visual budget and use only supplied inputs, evidence IDs, and supported block contracts. Do not write prose, HTML, CSS, JavaScript, or raw ECharts options. Write the declared artifact and finish with ELEMENTS_READY.`,
								reads: [
									t`${item("write.chapter-production", "chapterPlanPath")}`,
									t`${item("write.chapter-production", "visualCatalogPath")}`,
								],
								artifacts: {
									elements: artifact(t`${item("write.chapter-production", "elementPath")}`, ElementPackage),
								},
							}),
							transitions: { ELEMENTS_READY: "validate-elements" },
						},
						"validate-elements": {
							kind: "state",
							action: script("tsx", [workflowFile("scripts/validate-elements.ts")], {
								env: {
									WORK_JSON: t`${json(item("write.chapter-production"))}`,
									ELEMENTS_FILE: t`${item("write.chapter-production", "elementPath")}`,
									VISUAL_CATALOG_FILE: t`${item("write.chapter-production", "visualCatalogPath")}`,
								},
								reply: PlanGateFeedback,
							}),
							transitions: {
								ELEMENTS_VALID: "copywrite",
								ELEMENTS_INVALID: { target: "generate-elements", input: { feedback: event() } },
							},
						},
						copywrite: {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							onReenter: resume(
								t`Patch the current chapter package in place instead of rewriting it from scratch. Current work item and cumulative manuscript feedback: ${json(item("write.chapter-production"))}. Latest deterministic feedback: ${json(input("feedback"))}. Preserve every previously accepted correction, edit only the named modules/claims, keep prose concise, and finish with CHAPTER_WRITTEN.`,
							),
							action: agent("report-engine-copywriter", {
								task: t`Turn one atomic planned chapter into polished editorial content.\n\nWork item: ${json(item("write.chapter-production"))}\nFeedback: ${json(input("feedback"))}\n\nRead the current element package. Write one module per verified beat, lead into and interpret visuals, preserve evidence IDs and caveats, and create a clean handoff. Do not change element specs or write HTML/CSS/JS. Write the declared artifact and finish with CHAPTER_WRITTEN.`,
								reads: [
									t`${item("write.chapter-production", "chapterPlanPath")}`,
									t`${item("write.chapter-production", "elementPath")}`,
								],
								artifacts: { section: artifact(t`${item("write.chapter-production", "chapterPath")}`, SectionPackage) },
							}),
							transitions: { CHAPTER_WRITTEN: "validate-chapter" },
						},
						"validate-chapter": {
							kind: "state",
							action: script("tsx", [workflowFile("scripts/validate-chapter.ts")], {
								env: {
									WORK_JSON: t`${json(item("write.chapter-production"))}`,
									ELEMENTS_FILE: t`${item("write.chapter-production", "elementPath")}`,
									CHAPTER_FILE: t`${item("write.chapter-production", "chapterPath")}`,
								},
								reply: PlanGateFeedback,
							}),
							transitions: {
								CHAPTER_VALID: "done",
								CHAPTER_INVALID: { target: "copywrite", input: { feedback: event() } },
							},
						},
						done: final(),
					},
					onDone: "assemble-document",
				}),
				"assemble-document": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/assemble-report-document.ts")], {
						env: {
							PLAN_FILE: artifactOf("plan.assemble-plan"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							EXPERIENCE_FILE: artifactOf("write.experience-plan"),
							WORK_FILE: artifactOf("write.prepare-chapter-work"),
							OUTPUT_PATH: "artifacts/write/report-document.json",
						},
						artifacts: { document: artifact("artifacts/write/report-document.json", ReportDocument) },
						reply: DocumentManifest,
					}),
					transitions: { DOCUMENT_READY: "manuscript-gate" },
				},
				"manuscript-gate": {
					kind: "state",
					onReenter: resume(
						"Review the updated manuscript against your previous requested corrections first. Preserve closed findings and do not introduce new preference-level criteria. PASS when no material evidence, coherence, or renderability defect remains; perfection is not required. Request only changes implementable with the chapter's verified beat evidence IDs and declared block schema.",
					),
					action: agent("report-engine-manuscript-gate", {
						task: "Review the complete assembled manuscript across all chapters together. PASS when progression, chapter rhythm, repetition, transitions, evidence-backed copy, and visual composition materially work as one report; perfection is not required. Respect each verified beat's evidence boundary and the declared block schema. On REWRITE return only material, implementable corrections for affected chapter ids with owner layout|copy|elements and focused instructions.",
						reads: [artifactOf("write.assemble-document"), artifactOf("write.prepare-chapter-work")],
						reply: ManuscriptGateFeedback,
					}),
					transitions: {
						PASS: "render-html",
						REWRITE: { target: "manuscript-rewrite-budget", input: { feedback: event() } },
					},
				},
				"manuscript-rewrite-budget": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script("tsx", [workflowFile("scripts/manuscript-rewrite-budget.ts")], {
						env: {
							BUDGET_VISIT: t`${visitRef("write.manuscript-rewrite-budget")}`,
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
						},
						reply: ManuscriptGateFeedback,
					}),
					transitions: {
						RETRY: { target: "route-chapter-rework", input: { feedback: event() } },
						CONTINUE_WITH_WARNINGS: "render-html",
					},
				},
				"route-chapter-rework": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script("tsx", [workflowFile("scripts/route-chapter-rework.ts")], {
						env: {
							WORK_FILE: artifactOf("write.prepare-chapter-work"),
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
							OUTPUT_PATH: "artifacts/write/chapter-rework.json",
						},
						artifacts: { work: artifact("artifacts/write/chapter-rework.json", SectionWorkItems) },
						reply: SectionWorkItems,
					}),
					transitions: { CHAPTER_REWORK_READY: { target: "chapter-production", input: { items: event("items") } } },
				},
				"render-html": {
					kind: "state",
					action: script("tsx", [workflowFile("engine/render-report.ts")], {
						env: { DOCUMENT_FILE: artifactOf("write.assemble-document"), OUTPUT_PATH: "artifacts/report.html" },
						artifacts: { report: artifact("artifacts/report.html") },
						reply: RenderManifest,
					}),
					transitions: { REPORT_RENDERED: "validate-render" },
				},
				"validate-render": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/validate-render.ts")], {
						env: {
							DOCUMENT_FILE: artifactOf("write.assemble-document"),
							HTML_FILE: artifactOf("write.render-html"),
							OUTPUT_PATH: "artifacts/write/render-review.json",
						},
						artifacts: { review: artifact("artifacts/write/render-review.json", RenderReview) },
						reply: RenderValidation,
					}),
					transitions: { RENDER_VALIDATED: "screenshot-report" },
				},
				"screenshot-report": {
					kind: "state",
					action: script("tsx", [workflowFile("scripts/screenshot-report.ts")], {
						env: {
							HTML_FILE: artifactOf("write.render-html"),
							OUTPUT_DIR: "artifacts/write/screenshots",
							OUTPUT_PATH: "artifacts/write/screenshots.json",
						},
						artifacts: { screenshots: artifact("artifacts/write/screenshots.json", ScreenshotManifest) },
						reply: ScreenshotManifest,
					}),
					transitions: { SCREENSHOTS_READY: "visual-qa" },
				},
				"visual-qa": {
					kind: "state",
					action: agent("report-engine-visual-qa", {
						task: t`Bounded visual QA pass ${visitRef("write.visual-qa")}. Read the deterministic render review and screenshot tile manifest, then open every referenced desktop/mobile tile. Verify that metric cards have real values, chart axes and labels are defined, tables/matrices are readable, no content is clipped, and mobile tiles remain legible. Treat deterministic PASS only as a technical prerequisite, not evidence of visual correctness. PASS with {reason:\"\",chapters:{},engineIssues:[]} only when presentable. Use CHAPTER_REWORK only for real chapter ids from the report plan. Never use pseudo-chapter ids such as frontmatter or sources; global navigation and renderer defects must use ENGINE_WARNING. Use ENGINE_WARNING for renderer-level issues. Never request another pass yourself. Write the declared QA artifact and finish with the matching event.`,
						reads: [artifactOf("write.validate-render"), artifactOf("write.screenshot-report")],
						artifacts: {
							review: artifact(
								t`artifacts/write/visual-qa-${visitRef("write.visual-qa")}.json`,
								ManuscriptGateFeedback,
							),
						},
						reply: ManuscriptGateFeedback,
					}),
					transitions: {
						PASS: "done",
						CHAPTER_REWORK: { target: "visual-rewrite-budget", input: { feedback: event() } },
						ENGINE_WARNING: { target: "finalize-visual-warnings", input: { feedback: event() } },
					},
				},
				"visual-rewrite-budget": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script("tsx", [workflowFile("scripts/visual-rewrite-budget.ts")], {
						env: { QA_VISIT: t`${visitRef("write.visual-qa")}`, FEEDBACK_JSON: t`${json(input("feedback"))}` },
						reply: ManuscriptGateFeedback,
					}),
					transitions: {
						ALLOW_REWRITE: { target: "route-chapter-rework", input: { feedback: event() } },
						QA_LIMIT_REACHED: { target: "finalize-visual-warnings", input: { feedback: event() } },
					},
				},
				"finalize-visual-warnings": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script("tsx", [workflowFile("scripts/finalize-visual-warnings.ts")], {
						env: {
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
							OUTPUT_PATH: "artifacts/write/visual-qa-warnings.json",
						},
						artifacts: { warnings: artifact("artifacts/write/visual-qa-warnings.json", VisualWarnings) },
					}),
					transitions: { WARNINGS_SAVED: "done-with-warnings" },
				},
				done: final(),
				"done-with-warnings": final(),
			},
			transitions: { FAILED: "failed" },
			onDone: "done",
		}),

		done: final(),
		failed: final(),
	},
});
