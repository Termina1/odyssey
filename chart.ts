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
const tsxCommand = workflowFile("node_modules/.bin/tsx");

import {
	type BeatDraft,
	BeatDraftOutput,
	type BeatItems,
	BeatItemsOutput,
	BeatPatch,
	BeatPatchOutput,
	type BeatVerdict,
	BeatVerdictOutput,
	type BeatWorkItem,
	type ChapterPlan,
	ChapterPlanOutput,
	type ClosureReview,
	ClosureReviewOutput,
	DeepResearch,
	type DeepResearchAgenda,
	DeepResearchAgendaOutput,
	type DeepResearchTake,
	type DocumentManifest,
	DocumentManifestOutput,
	ElementPackage,
	type EvidenceIndex,
	EvidenceIndexOutput,
	type EvidenceManifest,
	EvidenceManifestOutput,
	type EvidenceRegisterPatch,
	EvidenceRegisterPatchOutput,
	type ExperiencePlan,
	ExperiencePlanOutput,
	GateFeedback,
	GateFeedbackOutput,
	type InitialResearch,
	InitialResearchOutput,
	JsonPatch,
	JsonPatchOutput,
	ManuscriptGateFeedback,
	ManuscriptGateFeedbackOutput,
	type NarrativeSkeleton,
	NarrativeSkeletonOutput,
	NarrativeStrategy,
	PlanGateFeedback,
	PlanGateFeedbackOutput,
	type PlanManifest,
	PlanManifestOutput,
	type RenderManifest,
	RenderManifestOutput,
	type RenderReview,
	RenderReviewOutput,
	RenderValidationOutput,
	type ReportDocument,
	ReportDocumentOutput,
	type ReportPlan,
	ReportPlanOutput,
	type ScreenshotManifest,
	ScreenshotManifestOutput,
	type SectionBeatDraft,
	SectionBeatDraftOutput,
	type SectionBeatWorkItem,
	type SectionBeatWorkItems,
	SectionBeatWorkItemsOutput,
	SectionBeatWorkReplyOutput,
	type SectionPackage,
	SectionPackageOutput,
	SectionWorkItem,
	type SectionWorkItems,
	SectionWorkItemsOutput,
	type TakeManifest,
	TakeManifestOutput,
	type VisualCatalog,
	VisualCatalogOutput,
	VisualInput,
	type VisualWarnings,
	VisualWarningsOutput,
	type VisualWorkItem,
	type VisualWorkItems,
	VisualWorkItemsOutput,
} from "./contracts/index.js";

type Args = {
	prompt: string;
	evidenceDepth: "skim" | "standard" | "deep";
	productionPolish: "draft" | "report" | "release";
};

type Results = {
	"research.plan-research": z.infer<typeof DeepResearchAgenda>;
	"research.deep-research.scout": z.infer<typeof TakeManifest>;
	"research.deep-research.gate": z.infer<typeof GateFeedback>;
	"research.deep-research.gate-budget": z.infer<typeof GateFeedback>;
	"research.evidence-register-review": z.infer<typeof PlanGateFeedback>;
	"research.apply-evidence-register-patch": z.infer<typeof EvidenceManifest>;
	"research.assemble-evidence": z.infer<typeof EvidenceManifest>;
	"plan.strategy-gate": z.infer<typeof PlanGateFeedback>;
	"plan.strategy-budget": z.infer<typeof PlanGateFeedback>;
	"plan.beats.prepare-section-beats": z.infer<typeof SectionBeatWorkItems>;
	"plan.beats.assemble-section-beats": z.infer<typeof PlanGateFeedback>;
	"plan.beats.route-beats": z.infer<typeof PlanGateFeedback>;
	"plan.beats.apply-beat-patch": z.infer<typeof PlanGateFeedback>;
	"plan.beats.prepare-beats": z.infer<typeof BeatItems>;
	"plan.finalize.verification.assemble-plan": z.infer<typeof PlanManifest>;
	"plan.finalize.verification.closure-check": z.infer<typeof ClosureReview>;
	"plan.finalize.layout.experience-plan": z.infer<typeof ExperiencePlan>;
	"write.prepare-chapter-work": z.infer<typeof SectionWorkItems>;
	"write.chapter-production.route": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.plan-chapter": z.infer<typeof ChapterPlan>;
	"write.chapter-production.prepare-visual-work": z.infer<typeof VisualWorkItems>;
	"write.chapter-production.visual-inputs.triage": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.visual-inputs.gate": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.visual-inputs.retry-budget": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.route-elements": z.infer<typeof PlanGateFeedback>;
	"write.chapter-production.apply-element-patch": z.infer<typeof PlanGateFeedback>;
	"write.assemble-document": z.infer<typeof DocumentManifest>;
	"write.manuscript-gate": z.infer<typeof ManuscriptGateFeedback>;
	"write.manuscript-rewrite-budget": z.infer<typeof ManuscriptGateFeedback>;
	"write.route-chapter-rework": z.infer<typeof SectionWorkItems>;
	"write.production-manuscript-route": z.infer<typeof PlanGateFeedback>;
	"write.render-html": z.infer<typeof RenderManifest>;
	"write.production-visual-route": z.infer<typeof PlanGateFeedback>;
	"write.screenshot-report": z.infer<typeof ScreenshotManifest>;
	"write.visual-qa": z.infer<typeof ManuscriptGateFeedback>;
	"write.visual-rewrite-budget": z.infer<typeof ManuscriptGateFeedback>;
};

type Files = {
	"research.initial-research.landscape.scout": { research: z.infer<typeof InitialResearch> };
	"research.initial-research.evidence.scout": { research: z.infer<typeof InitialResearch> };
	"research.initial-research.tensions.scout": { research: z.infer<typeof InitialResearch> };
	"research.plan-research": {
		skeleton: z.infer<typeof NarrativeSkeleton>;
		agenda: z.infer<typeof DeepResearchAgenda>;
	};
	"research.deep-research.scout": { research: z.infer<typeof DeepResearch> };
	"research.evidence-register-review": { patch: z.infer<typeof EvidenceRegisterPatch> };
	"research.apply-evidence-register-patch": { evidence: z.infer<typeof EvidenceIndex> };
	"research.assemble-evidence": { evidence: z.infer<typeof EvidenceIndex> };
	"plan.strategy.narrative-strategy": { strategy: z.infer<typeof NarrativeStrategy> };
	"plan.beats.prepare-section-beats": { work: z.infer<typeof SectionBeatWorkItems> };
	"plan.beats.section-beats.generate": { section: z.infer<typeof SectionBeatDraft> };
	"plan.beats.assemble-section-beats": { beats: z.infer<typeof BeatDraft> };
	"plan.beats.beat-patch": { patch: z.infer<typeof BeatPatch> };
	"plan.beats.apply-beat-patch": { beats: z.infer<typeof BeatDraft> };
	"plan.beats.prepare-beats": { items: z.infer<typeof BeatItems> };
	"plan.finalize.verification.verify-beats.verify": { verified: z.infer<typeof BeatVerdict> };
	"plan.finalize.verification.assemble-plan": { plan: z.infer<typeof ReportPlan> };
	"plan.finalize.verification.closure-check": { closure: z.infer<typeof ClosureReview> };
	"plan.finalize.layout.experience-plan": { experience: z.infer<typeof ExperiencePlan> };
	"write.prepare-chapter-work": { work: z.infer<typeof SectionWorkItems> };
	"write.chapter-production.plan-chapter": { plan: z.infer<typeof ChapterPlan> };
	"write.chapter-production.prepare-visual-work": { work: z.infer<typeof VisualWorkItems> };
	"write.chapter-production.visual-inputs.acquire": { input: z.infer<typeof VisualInput> };
	"write.chapter-production.assemble-visual-inputs": { catalog: z.infer<typeof VisualCatalog> };
	"write.chapter-production.generate-elements": { elements: z.infer<typeof ElementPackage> };
	"write.chapter-production.element-patch": { patch: z.infer<typeof JsonPatch> };
	"write.chapter-production.apply-element-patch": { elements: z.infer<typeof ElementPackage> };
	"write.chapter-production.copywrite": { section: z.infer<typeof SectionPackage> };
	"write.route-chapter-rework": { work: z.infer<typeof SectionWorkItems> };
	"write.assemble-document": { document: z.infer<typeof ReportDocument> };
	"write.render-html": { report: unknown; review: z.infer<typeof RenderReview> };
	"write.screenshot-report": { screenshots: z.infer<typeof ScreenshotManifest> };
	"write.visual-qa": { review: z.infer<typeof ManuscriptGateFeedback> };
	"write.finalize-visual-warnings": { warnings: z.infer<typeof VisualWarnings> };
};

type Maps = {
	"research.deep-research": z.infer<typeof DeepResearchTake>;
	"plan.beats.section-beats": z.infer<typeof SectionBeatWorkItem>;
	"plan.finalize.verification.verify-beats": z.infer<typeof BeatWorkItem>;
	"write.chapter-production": z.infer<typeof SectionWorkItem>;
	"write.chapter-production.visual-inputs": z.infer<typeof VisualWorkItem>;
};

type Inputs = {
	"research.deep-research.scout": { feedback: z.infer<typeof GateFeedback> };
	"research.deep-research.gate-budget": { feedback: z.infer<typeof GateFeedback> };
	"research.evidence-register-review": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.strategy.narrative-strategy": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.strategy-budget": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.beats.prepare-section-beats": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.planning-invalid": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.beats.beat-patch": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.beats.apply-beat-patch": { patch: z.infer<typeof BeatPatch> };
	"plan.finalize.verification.verify-beats.verify": { feedback: z.infer<typeof PlanGateFeedback> };
	"plan.finalize.layout.experience-plan": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production": { items: Record<string, z.infer<typeof SectionWorkItem>> };
	"write.chapter-production.plan-chapter": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.visual-inputs.acquire": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.visual-inputs.retry-budget": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.generate-elements": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.element-patch": { feedback: z.infer<typeof PlanGateFeedback> };
	"write.chapter-production.apply-element-patch": { patch: z.infer<typeof JsonPatch> };
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

const RESEARCH_CAPS_TEXT =
	"Hard caps per take by evidence depth (sources/findings): skim = 4/8, standard = 8/20, deep = 16/48. The caps bound the TOTAL artifact you write — including findings preserved from earlier attempts after gate feedback. When merging preserved and new material, drop the weakest sources and findings to stay within the caps.";

const initialScout = (angleId: "landscape" | "evidence" | "tensions", brief: string) =>
	compound({
		initial: "scout",
		states: {
			scout: {
				kind: "state",
				action: agent("report-engine-research-scout", {
					task: t`Run a bounded initial research pass for this request:\n\n${arg("prompt")}\n\n${brief} Write the declared artifact with angleId "${angleId}" and finish with SCOUTED.`,
					artifacts: {
						research: artifact(`artifacts/research/initial/${angleId}.json`, InitialResearchOutput),
					},
				}),
				transitions: { SCOUTED: "done" },
			},
			done: final(),
		},
	});

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
						landscape: initialScout(
							"landscape",
							"Angle: Landscape — definitions, current state, key actors, timeline, and strong primary or overview sources. Build context only; do not deep-dive or create a report outline.",
						),
						evidence: initialScout(
							"evidence",
							"Angle: Evidence and mechanics — measurable facts, mechanisms, causal claims, primary data, and concrete examples. Separate supported mechanisms from assumptions. Do not deep-dive or create a report outline.",
						),
						tensions: initialScout(
							"tensions",
							"Angle: Tensions and implications — credible disagreement, risks, trade-offs, alternatives, consequences, and unresolved questions. Build context only; do not deep-dive or create a report outline.",
						),
					},
					onDone: "plan-research",
				}),

				"plan-research": {
					kind: "state",
					action: agent("report-engine-planner", {
						task: t`Plan the narrative skeleton and the focused deep-research agenda for this request in one pass:\n\n${arg("prompt")}\n\nEvidence depth: ${arg("evidenceDepth")}\n\nRead the three initial research artifacts. First define a provisional narrative skeleton — thesis, reader question, ordered beats, evidence needs, and coverage tags — and write it to the declared skeleton artifact. Then choose only deep-research takes that close skeleton coverage gaps and write them to the declared agenda artifact, declaring coverageTags, depthBudget, and stopRule per take plus a global stopRule. Take-count caps by depth: skim = 4, standard = 10, deep = 24; never set a take depthBudget above its findings cap. Finish with DEEP_RESEARCH_PLANNED using the agenda as structured output.`,
						reads: [
							artifactOf("research.initial-research.landscape.scout"),
							artifactOf("research.initial-research.evidence.scout"),
							artifactOf("research.initial-research.tensions.scout"),
						],
						artifacts: {
							skeleton: artifact("artifacts/research/narrative-skeleton.json", NarrativeSkeletonOutput),
							agenda: artifact("artifacts/research/deep-research-agenda.json", DeepResearchAgendaOutput),
						},
						reply: DeepResearchAgendaOutput,
					}),
					validate: script(tsxCommand, [workflowFile("guards/validate-depth-agenda.ts")], {
						env: {
							AGENDA_FILE: artifactOf("research.plan-research", { artifact: "agenda" }),
							EVIDENCE_DEPTH: t`${arg("evidenceDepth")}`,
							SKELETON_FILE: artifactOf("research.plan-research", { artifact: "skeleton" }),
						},
						reply: PlanGateFeedbackOutput,
					}),
					onReject: "resume",
					retries: 2,
					transitions: { DEEP_RESEARCH_PLANNED: "deep-research" },
				},

				"deep-research": map({
					over: result("research.plan-research", "takes"),
					concurrency: 6,
					initial: "scout",
					states: {
						scout: {
							kind: "state",
							input: { feedback: GateFeedback.default(emptyResearchFeedback) },
							onReenter: resume(
								t`Preserve accepted findings and address only this gate delta: ${json(input("feedback"))}. ${RESEARCH_CAPS_TEXT} Write the complete revised artifact to artifacts/research/deep/${key("research.deep-research")}/research-${visitRef("research.deep-research.scout")}.json, then finish with SCOUTED.`,
							),
							action: agent("report-engine-research-scout", {
								task: t`Research one deep take for this request:\n\n${arg("prompt")}\n\nEvidence depth: ${arg("evidenceDepth")}\nTake key: ${key("research.deep-research")}\nTake: ${json(item("research.deep-research"))}\nAttempt: ${visitRef("research.deep-research.scout")}\nGate feedback: ${json(input("feedback"))}\n\n${RESEARCH_CAPS_TEXT}\n\nWrite a complete versioned artifact to artifacts/research/deep/${key("research.deep-research")}/research-${visitRef("research.deep-research.scout")}.json and finish with SCOUTED using output {takeId, artifactPath, sourceCount, evidenceCount}.`,
								artifacts: {
									research: artifact(
										t`artifacts/research/deep/${key("research.deep-research")}/research-${visitRef("research.deep-research.scout")}.json`,
										DeepResearch,
									),
								},
								reply: TakeManifestOutput,
							}),
							validate: script(tsxCommand, [workflowFile("guards/validate-take.ts")], {
								env: {
									EVIDENCE_DEPTH: t`${arg("evidenceDepth")}`,
									EXPECTED_TAKE_ID: t`${key("research.deep-research")}`,
									ARTIFACT_FILE: artifactOf("research.deep-research.scout"),
								},
							}),
							onReject: "resume",
							retries: 2,
							transitions: { SCOUTED: "gate" },
						},
						gate: {
							kind: "state",
							action: agent("report-engine-research-gate", {
								task: t`Gate one deep-research take.\n\nTake: ${json(item("research.deep-research"))}\nAttempt: ${visitRef("research.deep-research.scout")}\n\nRead only the supplied artifact. PASS when acceptance criteria are materially satisfied. BLOCK only for consequential missing evidence and return the smallest delta.`,
								reads: [artifactOf("research.deep-research.scout")],
								reply: GateFeedbackOutput,
							}),
							transitions: {
								PASS: "done",
								BLOCK: { target: "gate-budget", input: { feedback: event() } },
							},
						},
						"gate-budget": {
							kind: "state",
							input: { feedback: GateFeedback.default(emptyResearchFeedback) },
							action: script(tsxCommand, [workflowFile("scripts/loop-budget.ts")], {
								env: {
									ATTEMPT: t`${visitRef("research.deep-research.scout")}`,
									LIMIT: "2",
									FEEDBACK_JSON: t`${json(input("feedback"))}`,
								},
								reply: GateFeedbackOutput,
							}),
							transitions: {
								RETRY: { target: "scout", input: { feedback: event() } },
								PROCEED: "done",
							},
						},
						done: final(),
					},
					onDone: "assemble-evidence",
				}),

				"assemble-evidence": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/assemble-evidence.ts")], {
						env: {
							TAKE_FILES: joinArtifactOf("research.deep-research.scout"),
							OUTPUT_PATH: "artifacts/research/evidence-index.json",
							PRODUCTION_POLISH: t`${arg("productionPolish")}`,
						},
						artifacts: { evidence: artifact("artifacts/research/evidence-index.json", EvidenceIndexOutput) },
						reply: EvidenceManifestOutput,
					}),
					transitions: { REVIEW_REQUIRED: "evidence-register-review", REGISTER_CLEAN: "done" },
				},
				"evidence-register-review": {
					kind: "state",
					input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
					onReenter: resume(
						t`Review the evidence register using validator feedback: ${json(input("feedback"))}. Preserve immutable IDs and emit only a bounded status/rationale/evidenceIds patch.`,
					),
					action: agent("report-engine-planner", {
						task: t`Review the evidence register. Resolve or downgrade only consequential entries with evidence-backed rationale. Emit at most 8 operations, preserving exact IDs/descriptions and citing existing evidence IDs; emit [] when no safe change is justified.`,
						reads: [artifactOf("research.assemble-evidence")],
						artifacts: {
							patch: artifact(
								t`artifacts/research/evidence-register-patch-${visitRef("research.evidence-register-review")}.json`,
								EvidenceRegisterPatchOutput,
							),
						},
					}),
					validate: script(tsxCommand, [workflowFile("guards/validate-evidence-register-patch.ts")], {
						env: {
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							PATCH_FILE: artifactOf("research.evidence-register-review"),
						},
						reply: PlanGateFeedbackOutput,
					}),
					onReject: "resume",
					retries: 2,
					transitions: { REGISTER_REVIEW_READY: "apply-evidence-register-patch" },
				},
				"apply-evidence-register-patch": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/apply-evidence-register-patch.ts")], {
						env: {
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							PATCH_FILE: artifactOf("research.evidence-register-review"),
							OUTPUT_PATH: "artifacts/research/evidence-index.json",
						},
						artifacts: { evidence: artifact("artifacts/research/evidence-index.json", EvidenceIndexOutput) },
						reply: EvidenceManifestOutput,
					}),
					transitions: { REGISTER_PATCH_APPLIED: "done" },
				},
				done: final(),
			},
			transitions: { FAILED: "failed" },
			onDone: "plan",
		}),

		plan: compound({
			initial: "strategy",
			states: {
				strategy: compound({
					initial: "narrative-strategy",
					states: {
						"narrative-strategy": {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							onReenter: resume(
								t`Revise only the narrative strategy using this gate feedback: ${json(input("feedback"))}. Write the complete revised strategy to artifacts/plan/strategy-${visitRef("plan.strategy.narrative-strategy")}.json, then finish with STRATEGY_READY.`,
							),
							action: agent("report-engine-planner", {
								task: t`Create an evidence-led narrative strategy for this report request:\n\n${arg("prompt")}\n\nGate feedback: ${json(input("feedback"))}\n\nRead the immutable evidence index. Define one supportable thesis, reader question, ordered sections, evidence allocation, exclusions, and style notes. Do not draft beats or prose. Write to artifacts/plan/strategy-${visitRef("plan.strategy.narrative-strategy")}.json, then finish with STRATEGY_READY.`,
								reads: [artifactOf("research.assemble-evidence")],
								artifacts: {
									strategy: artifact(
										t`artifacts/plan/strategy-${visitRef("plan.strategy.narrative-strategy")}.json`,
										NarrativeStrategy,
									),
								},
							}),
							validate: script(tsxCommand, [workflowFile("guards/validate-strategy.ts")], {
								env: {
									STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
									EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
								},
								reply: PlanGateFeedbackOutput,
							}),
							onReject: "resume",
							retries: 2,
							transitions: { STRATEGY_READY: "strategy-gate" },
						},

						"strategy-gate": {
							kind: "state",
							action: agent("report-engine-plan-gate", {
								task: "Strategy-gate mode. Review the proposed strategy against the supplied evidence index. Finish with STRATEGY_PASS when thesis, reader question, section progression, evidence allocation, and exclusions are sound. Finish with STRATEGY_BLOCK only for consequential problems. Return {reason,instructions}.",
								reads: [artifactOf("plan.strategy.narrative-strategy"), artifactOf("research.assemble-evidence")],
								reply: PlanGateFeedbackOutput,
							}),
							transitions: {
								STRATEGY_PASS: "done",
								STRATEGY_BLOCK: { target: "strategy-budget", input: { feedback: event() } },
							},
						},
						"strategy-budget": {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							action: script(tsxCommand, [workflowFile("scripts/loop-budget.ts")], {
								env: {
									ATTEMPT: t`${visitRef("plan.strategy.narrative-strategy")}`,
									LIMIT: "2",
									FEEDBACK_JSON: t`${json(input("feedback"))}`,
								},
								reply: PlanGateFeedbackOutput,
							}),
							transitions: {
								RETRY: { target: "narrative-strategy", input: { feedback: event() } },
								PROCEED: "done",
							},
						},

						done: final(),
					},
					onDone: "beats",
				}),
				beats: compound({
					initial: "prepare-section-beats",
					states: {
						"prepare-section-beats": {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							action: script(tsxCommand, [workflowFile("scripts/prepare-section-beat-work.ts")], {
								env: {
									STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
									EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
									CURRENT_BEATS_FILE: "artifacts/plan/beats-candidate.json",
									FEEDBACK_JSON: t`${json(input("feedback"))}`,
									ATTEMPT: t`${visitRef("plan.beats.prepare-section-beats")}`,
									OUTPUT_PATH: t`artifacts/plan/section-beat-work-${visitRef("plan.beats.prepare-section-beats")}.json`,
								},
								artifacts: {
									work: artifact(
										t`artifacts/plan/section-beat-work-${visitRef("plan.beats.prepare-section-beats")}.json`,
										SectionBeatWorkItemsOutput,
									),
								},
								reply: SectionBeatWorkReplyOutput,
							}),
							transitions: {
								SECTION_BEAT_WORK_READY: "section-beats",
								SECTION_REPAIR_EXHAUSTED: { target: "planning-invalid", input: { feedback: event() } },
							},
						},
						"section-beats": map({
							over: result("plan.beats.prepare-section-beats", "items"),
							concurrency: 5,
							initial: "generate",
							states: {
								generate: {
									kind: "state",
									action: agent("report-engine-section-beat-planner", {
										task: t`Generate or repair exactly one section of the stable beat candidate. Work item: ${json(item("plan.beats.section-beats"))}. In repair mode preserve every unaffected beat and apply only the supplied topology feedback. Write the complete section artifact and finish with SECTION_BEATS_READY.`,
										artifacts: {
											section: artifact(
												t`artifacts/plan/section-beats/${key("plan.beats.section-beats")}-${visitRef("plan.beats.section-beats.generate")}.json`,
												SectionBeatDraftOutput,
											),
										},
									}),
									validate: script(tsxCommand, [workflowFile("guards/validate-section-beats.ts")], {
										env: {
											WORK_JSON: t`${json(item("plan.beats.section-beats"))}`,
											DRAFT_FILE: artifactOf("plan.beats.section-beats.generate"),
										},
									}),
									onReject: "resume",
									retries: 2,
									transitions: { SECTION_BEATS_READY: "done" },
								},
								done: final(),
							},
							onDone: "assemble-section-beats",
						}),
						"assemble-section-beats": {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/assemble-section-beats.ts")], {
								env: {
									SECTION_FILES: joinArtifactOf("plan.beats.section-beats.generate"),
									STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
									CURRENT_BEATS_FILE: "artifacts/plan/beats-candidate.json",
									OUTPUT_PATH: "artifacts/plan/beats-candidate.json",
									SNAPSHOT_PATH: t`artifacts/plan/beats-candidate-assembled-${visitRef("plan.beats.assemble-section-beats")}.json`,
								},
								artifacts: { beats: artifact("artifacts/plan/beats-candidate.json", BeatDraftOutput) },
								reply: PlanGateFeedbackOutput,
							}),
							transitions: { SECTION_BEATS_ASSEMBLED: "route-beats" },
						},

						"route-beats": {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/route-beats.ts")], {
								env: {
									DRAFT_FILE: "artifacts/plan/beats-candidate.json",
									EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
									STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
									ROUTE_VISIT: t`${visitRef("plan.beats.route-beats")}`,
								},
								reply: PlanGateFeedbackOutput,
							}),
							transitions: {
								BEATS_VALID: "prepare-beats",
								BEAT_PATCH_REQUIRED: { target: "beat-patch", input: { feedback: event() } },
								BEATS_INVALID: { target: "prepare-section-beats", input: { feedback: event() } },
							},
						},
						"planning-invalid": {
							kind: "state",
							input: { feedback: PlanGateFeedback },
							action: script(tsxCommand, [workflowFile("scripts/fail-closed.ts")], {
								env: { REASON: t`${input("feedback", "reason")}` },
							}),
						},
						"beat-patch": {
							kind: "state",
							input: { feedback: PlanGateFeedback },
							action: agent("report-engine-planner", {
								task: t`Produce a bounded beat JSON micro-patch. Feedback: ${json(input("feedback"))}. Read the stable candidate and evidence index; patch only named evidenceIds and preserve all beat identity/dependencies.`,
								reads: [t`artifacts/plan/beats-candidate.json`, t`artifacts/research/evidence-index.json`],
								artifacts: {
									patch: artifact(
										t`artifacts/plan/beat-patch-${visitRef("plan.beats.beat-patch")}.json`,
										BeatPatchOutput,
									),
								},
								reply: BeatPatchOutput,
							}),
							transitions: { PATCH_READY: { target: "apply-beat-patch", input: { patch: event() } } },
						},
						"apply-beat-patch": {
							kind: "state",
							input: { patch: BeatPatch },
							action: script(tsxCommand, [workflowFile("scripts/apply-beat-patch.ts")], {
								env: {
									CANDIDATE_FILE: "artifacts/plan/beats-candidate.json",
									PATCH_JSON: t`${json(input("patch"))}`,
									EVIDENCE_FILE: "artifacts/research/evidence-index.json",
									OUTPUT_PATH: "artifacts/plan/beats-candidate.json",
									SNAPSHOT_PATH: t`artifacts/plan/beats-candidate-patched-${visitRef("plan.beats.apply-beat-patch")}.json`,
								},
								artifacts: { beats: artifact("artifacts/plan/beats-candidate.json", BeatDraftOutput) },
								reply: PlanGateFeedbackOutput,
							}),
							transitions: { BEAT_PATCH_APPLIED: "route-beats" },
						},
						"prepare-beats": {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/prepare-beats.ts")], {
								env: {
									REQUEST: t`${arg("prompt")}`,
									DRAFT_FILE: "artifacts/plan/beats-candidate.json",
									EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
									STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
									OUTPUT_PATH: t`artifacts/plan/beat-items-${visitRef("plan.beats.prepare-beats")}.json`,
									PACKET_DIR: t`artifacts/plan/beat-packets-${visitRef("plan.beats.prepare-beats")}`,
								},
								artifacts: {
									items: artifact(
										t`artifacts/plan/beat-items-${visitRef("plan.beats.prepare-beats")}.json`,
										BeatItemsOutput,
									),
								},
								reply: BeatItemsOutput,
							}),
							transitions: { BEAT_ITEMS_READY: "done" },
						},

						done: final(),
					},
					onDone: "finalize",
				}),
				finalize: parallel({
					states: {
						verification: compound({
							initial: "verify-beats",
							states: {
								"verify-beats": map({
									over: result("plan.beats.prepare-beats", "items"),
									concurrency: 8,
									initial: "verify",
									states: {
										verify: {
											kind: "state",
											input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
											onReenter: "restart",
											action: agent("report-engine-beat-verifier", {
												task: t`Verify one narrative beat against its compact evidence packet.\n\nBeat: ${json(item("plan.finalize.verification.verify-beats"))}\nValidation feedback: ${json(input("feedback"))}\n\nWrite the verdict artifact to artifacts/plan/verified-beats/${key("plan.finalize.verification.verify-beats")}-${visitRef("plan.finalize.verification.verify-beats.verify")}.json containing ONLY {id, verdict, evidenceIds, confidence, caveat, notes}. id must equal the packet beat id and evidenceIds must be a subset of the packet evidence ids; the frozen beat fields are merged deterministically later, so never restate or edit them. Finish with VERIFIED.`,
												reads: [t`${item("plan.finalize.verification.verify-beats", "packetPath")}`],
												artifacts: {
													verified: artifact(
														t`artifacts/plan/verified-beats/${key("plan.finalize.verification.verify-beats")}-${visitRef("plan.finalize.verification.verify-beats.verify")}.json`,
														BeatVerdictOutput,
													),
												},
											}),
											validate: script(tsxCommand, [workflowFile("guards/validate-verified-beat.ts")], {
												env: {
													VERIFIED_FILE: artifactOf("plan.finalize.verification.verify-beats.verify"),
													PACKET_FILE: t`${item("plan.finalize.verification.verify-beats", "packetPath")}`,
												},
												reply: PlanGateFeedbackOutput,
											}),
											onReject: "restart",
											retries: 2,
											transitions: { VERIFIED: "done" },
										},
										done: final(),
									},
									onDone: "assemble-plan",
								}),

								"assemble-plan": {
									kind: "state",
									action: script(tsxCommand, [workflowFile("scripts/assemble-plan.ts")], {
										env: {
											STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
											BEAT_ITEMS_FILE: artifactOf("plan.beats.prepare-beats"),
											EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
											VERIFIED_FILES: joinArtifactOf("plan.finalize.verification.verify-beats.verify"),
											OUTPUT_PATH: t`artifacts/plan/report-plan-${visitRef("plan.finalize.verification.assemble-plan")}.json`,
										},
										artifacts: {
											plan: artifact(
												t`artifacts/plan/report-plan-${visitRef("plan.finalize.verification.assemble-plan")}.json`,
												ReportPlanOutput,
											),
										},
										reply: PlanManifestOutput,
									}),
									transitions: { PLAN_ASSEMBLED: "closure-check" },
								},
								"closure-check": {
									kind: "state",
									action: script(tsxCommand, [workflowFile("scripts/check-closure.ts")], {
										env: {
											PLAN_FILE: artifactOf("plan.finalize.verification.assemble-plan"),
											EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
											OUTPUT_PATH: "artifacts/plan/closure-review.json",
										},
										artifacts: { closure: artifact("artifacts/plan/closure-review.json", ClosureReviewOutput) },
										reply: ClosureReviewOutput,
									}),
									transitions: { CLOSURE_VALID: "done", CLOSURE_BLOCKED: "closure-blocked" },
								},
								"closure-blocked": {
									kind: "state",
									action: script(tsxCommand, [workflowFile("scripts/fail-closed.ts")], {
										env: {
											REASON: t`Closure blocked: ${result("plan.finalize.verification.closure-check", "reason")}`,
										},
									}),
								},
								done: final(),
							},
						}),
						layout: compound({
							initial: "experience-plan",
							states: {
								"experience-plan": {
									kind: "state",
									input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
									onReenter: "restart",
									action: agent("report-engine-layout-planner", {
										task: t`Create the global editorial and visual experience plan for this report:\n\n${arg("prompt")}\n\nFeedback: ${json(input("feedback"))}\n\nRead the narrative strategy, the beats candidate, and the evidence index. Allocate prose versus visual anchors across the whole report, define chapter rhythm, visual budgets, beat presentation roles, high-level visual intent, and preferred outputs. Do not create concrete visual requests; each atomic chapter planner will do that later. Do not write prose, block payloads, HTML, CSS, JavaScript, or raw ECharts options. Write the declared versioned artifact and finish with EXPERIENCE_READY using the same plan as structured output.`,
										reads: [
											artifactOf("plan.strategy.narrative-strategy"),
											artifactOf("plan.beats.assemble-section-beats"),
											artifactOf("research.assemble-evidence"),
										],
										artifacts: {
											experience: artifact(
												t`artifacts/write/experience-${visitRef("plan.finalize.layout.experience-plan")}.json`,
												ExperiencePlanOutput,
											),
										},
										reply: ExperiencePlanOutput,
									}),
									validate: script(tsxCommand, [workflowFile("guards/validate-experience.ts")], {
										env: {
											STRATEGY_FILE: artifactOf("plan.strategy.narrative-strategy"),
											CANDIDATE_FILE: artifactOf("plan.beats.assemble-section-beats"),
											EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
											EXPERIENCE_FILE: artifactOf("plan.finalize.layout.experience-plan"),
										},
										reply: PlanGateFeedbackOutput,
									}),
									onReject: "restart",
									retries: 2,
									transitions: { EXPERIENCE_READY: "done" },
								},
								done: final(),
							},
						}),
					},
					onDone: "done",
				}),
				done: final(),
			},
			transitions: { FAILED: "failed" },
			onDone: "write",
		}),

		write: compound({
			initial: "prepare-chapter-work",
			states: {
				"prepare-chapter-work": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/prepare-chapter-work.ts")], {
						env: {
							PLAN_FILE: artifactOf("plan.finalize.verification.assemble-plan"),
							EXPERIENCE_FILE: artifactOf("plan.finalize.layout.experience-plan"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							OUTPUT_PATH: "artifacts/write/chapter-work.json",
						},
						artifacts: { work: artifact("artifacts/write/chapter-work.json", SectionWorkItemsOutput) },
						reply: SectionWorkItemsOutput,
					}),
					transitions: { CHAPTER_WORK_READY: { target: "chapter-production", input: { items: event("items") } } },
				},
				"chapter-production": map({
					input: { items: z.record(z.string(), SectionWorkItem) },
					over: input("items"),
					concurrency: 5,
					initial: "route",
					states: {
						route: {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/route-chapter-start.ts")], {
								env: { WORK_JSON: t`${json(item("write.chapter-production"))}` },
								reply: PlanGateFeedbackOutput,
							}),
							transitions: {
								START_LAYOUT: "plan-chapter",
								START_ELEMENTS: "generate-elements",
								START_COPY: "copywrite",
							},
						},
						"plan-chapter": {
							kind: "state",
							input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
							onReenter: resume(
								t`Patch the current chapter plan in place instead of replanning from scratch. Current work item and cumulative manuscript feedback: ${json(item("write.chapter-production"))}. Preserve accepted requests and constraints, modify only the requested layout/visual decisions, stay within verified beat evidence IDs and declared outputs, and finish with CHAPTER_PLANNED using the complete updated plan.`,
							),
							action: agent("report-engine-chapter-planner", {
								task: t`Plan one atomic chapter and its concrete lazy visual requests. Work item: ${json(item("write.chapter-production"))}. The work item embeds this chapter's verified beats plus their evidence records and source records — plan strictly within them. Decide visual intent before acquisition: every verified beat must declare inline or dataset-backed mode and guaranteedUse. Emit requests only for dataset-backed intents, with required=true, one beat, existing evidence IDs, and a fallback. Enforce chapter budget before acquisition.`,
								artifacts: {
									plan: artifact(t`${item("write.chapter-production", "chapterPlanPath")}`, ChapterPlanOutput),
								},
								reply: ChapterPlanOutput,
							}),
							validate: script(tsxCommand, [workflowFile("guards/validate-chapter-plan.ts")], {
								env: {
									CHAPTER_PLAN_FILE: t`${item("write.chapter-production", "chapterPlanPath")}`,
									WORK_JSON: t`${json(item("write.chapter-production"))}`,
									EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
								},
								reply: PlanGateFeedbackOutput,
							}),
							onReject: "resume",
							retries: 2,
							transitions: { CHAPTER_PLANNED: "prepare-visual-work" },
						},
						"prepare-visual-work": {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/prepare-visual-work.ts")], {
								env: {
									CHAPTER_PLAN_FILE: t`${item("write.chapter-production", "chapterPlanPath")}`,
									EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
									PACKET_DIR: t`artifacts/write/chapters/${key("write.chapter-production")}/visual-packets`,
									OUTPUT_PATH: t`artifacts/write/chapters/${key("write.chapter-production")}/visual-work.json`,
								},
								artifacts: {
									work: artifact(
										t`artifacts/write/chapters/${key("write.chapter-production")}/visual-work.json`,
										VisualWorkItemsOutput,
									),
								},
								reply: VisualWorkItemsOutput,
							}),
							transitions: { VISUAL_WORK_READY: "visual-inputs" },
						},
						"visual-inputs": map({
							over: result("write.chapter-production.prepare-visual-work", "items"),
							concurrency: 3,
							initial: "acquire",
							states: {
								acquire: {
									kind: "state",
									input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
									onReenter: resume(
										t`Repair only this visual input using validator feedback: ${json(input("feedback"))}. Preserve request identity and valid provenance; do not broaden acquisition.`,
									),
									action: agent("report-engine-visual-researcher", {
										task: t`Acquire exactly one visual input lazily for one chapter.\n\nChapter: ${key("write.chapter-production")}\nRequest: ${json(item("write.chapter-production.visual-inputs"))}\nAttempt: ${visitRef("write.chapter-production.visual-inputs.acquire")} of 2\nFeedback: ${json(input("feedback"))}\n\nThe supplied packet file contains this request plus its evidence records and source records; read it first and start from its source URLs, searching beyond them only for missing input. Do not introduce unsupported claims. The output sourceIds array MUST contain only source-record IDs with the s_ prefix taken from the packet sources, never evidence/claim IDs with the e_ prefix. Evidence IDs belong only in dataset.provenance[].evidenceId. Write the declared artifact and finish with ACQUIRED; use status not-found plus fallback when acquisition fails.`,
										reads: [t`${item("write.chapter-production.visual-inputs", "packetPath")}`],
										artifacts: {
											input: artifact(
												t`artifacts/write/chapters/${key("write.chapter-production")}/visual-inputs/${key("write.chapter-production.visual-inputs")}-${visitRef("write.chapter-production.visual-inputs.acquire")}.json`,
												VisualInput,
											),
										},
									}),
									validate: script(tsxCommand, [workflowFile("guards/validate-visual-input.ts")], {
										env: {
											PACKET_FILE: t`${item("write.chapter-production.visual-inputs", "packetPath")}`,
											INPUT_FILE: artifactOf("write.chapter-production.visual-inputs.acquire", { artifact: "input" }),
											FEEDBACK_FILE: t`artifacts/write/chapters/${key("write.chapter-production")}/visual-inputs/${key("write.chapter-production.visual-inputs")}-feedback.json`,
										},
										reply: PlanGateFeedbackOutput,
									}),
									onReject: "restart",
									retries: 0,
									transitions: { ACQUIRED: "triage", FAILED: "retry-budget" },
								},
								triage: {
									kind: "state",
									action: script(tsxCommand, [workflowFile("scripts/route-visual-input.ts")], {
										env: {
											INPUT_FILE: artifactOf("write.chapter-production.visual-inputs.acquire", { artifact: "input" }),
										},
										reply: PlanGateFeedbackOutput,
									}),
									transitions: { NEEDS_GATE: "gate", NOT_FOUND_FALLBACK: "done" },
								},
								gate: {
									kind: "state",
									action: agent("report-engine-visual-gate", {
										task: t`Review one acquired visual input against this chapter request: ${json(item("write.chapter-production.visual-inputs"))}. PASS when usable, or BLOCK with a minimal acquisition delta.`,
										reads: [artifactOf("write.chapter-production.visual-inputs.acquire", { artifact: "input" })],
										reply: PlanGateFeedbackOutput,
									}),
									transitions: {
										PASS: "done",
										FALLBACK: "done",
										BLOCK: { target: "retry-budget", input: { feedback: event() } },
									},
								},
								"retry-budget": {
									kind: "state",
									input: { feedback: PlanGateFeedback.default(emptyPlanFeedback) },
									action: script(tsxCommand, [workflowFile("scripts/visual-input-retry-budget.ts")], {
										env: {
											ATTEMPT: t`${visitRef("write.chapter-production.visual-inputs.acquire")}`,
											REQUEST_JSON: t`${json(item("write.chapter-production.visual-inputs"))}`,
											INPUT_FILE: artifactOf("write.chapter-production.visual-inputs.acquire", { artifact: "input" }),
											FEEDBACK_JSON: t`${json(input("feedback"))}`,
											VALIDATION_FEEDBACK_FILE: t`artifacts/write/chapters/${key("write.chapter-production")}/visual-inputs/${key("write.chapter-production.visual-inputs")}-feedback.json`,
										},
										reply: PlanGateFeedbackOutput,
									}),
									transitions: { RETRY: { target: "acquire", input: { feedback: event() } }, FALLBACK: "done" },
								},
								done: final(),
							},
							onDone: "assemble-visual-inputs",
						}),
						"assemble-visual-inputs": {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/assemble-chapter-visual-inputs.ts")], {
								env: {
									SECTION_ID: t`${item("write.chapter-production", "sectionId")}`,
									VISUAL_FILES: joinArtifactOf("write.chapter-production.visual-inputs.acquire", { artifact: "input" }),
									OUTPUT_PATH: t`${item("write.chapter-production", "visualCatalogPath")}`,
								},
								artifacts: {
									catalog: artifact(t`${item("write.chapter-production", "visualCatalogPath")}`, VisualCatalogOutput),
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
								task: t`Generate the semantic visual element package for one atomic chapter.\n\nWork item: ${json(item("write.chapter-production"))}\nFeedback: ${json(input("feedback"))}\n\nRead the current chapter plan and validated chapter-local visual catalog. Budget contract: dataset/image-backed blocks and fallback blocks together must not exceed experience.visualBudget, and total blocks must not exceed maxBlocks from the work item. Use only supplied inputs, evidence IDs, and supported block contracts; when a valid chart binding is impossible for a dataset, render it as a table block instead. Do not write prose, HTML, CSS, JavaScript, or raw ECharts options. Write the declared artifact and finish with ELEMENTS_READY.`,
								reads: [
									t`${item("write.chapter-production", "chapterPlanPath")}`,
									t`${item("write.chapter-production", "visualCatalogPath")}`,
								],
								artifacts: {
									elements: artifact(t`${item("write.chapter-production", "elementPath")}`, ElementPackage),
								},
							}),
							transitions: { ELEMENTS_READY: "route-elements" },
						},
						"route-elements": {
							kind: "state",
							action: script(tsxCommand, [workflowFile("scripts/route-elements.ts")], {
								env: {
									WORK_JSON: t`${json(item("write.chapter-production"))}`,
									ELEMENTS_FILE: t`${item("write.chapter-production", "elementPath")}`,
									VISUAL_CATALOG_FILE: t`${item("write.chapter-production", "visualCatalogPath")}`,
									ATTEMPT: t`${visitRef("write.chapter-production.generate-elements")}`,
								},
								reply: PlanGateFeedbackOutput,
							}),
							transitions: {
								ELEMENTS_VALID: "copywrite",
								ELEMENTS_PATCH_REQUIRED: { target: "element-patch", input: { feedback: event() } },
								ELEMENTS_INVALID: { target: "generate-elements", input: { feedback: event() } },
							},
						},
						"element-patch": {
							kind: "state",
							input: { feedback: PlanGateFeedback },
							action: agent("report-engine-element-generator", {
								task: t`Create a targeted bounded JSON fallback patch. Work item: ${json(item("write.chapter-production"))}. Validator feedback: ${json(input("feedback"))}. Read the existing element artifact. Either add one renderer-valid fallback block at /blocks/- with fallbackRequestId, or add/replace only /blocks/N/fallbackRequestId on an existing compatible block. Preserve all unrelated blocks and fields.`,
								reads: [t`${item("write.chapter-production", "elementPath")}`],
								artifacts: {
									patch: artifact(
										t`artifacts/write/chapters/${key("write.chapter-production")}/element-patch-${visitRef("write.chapter-production.element-patch")}.json`,
										JsonPatchOutput,
									),
								},
								reply: JsonPatchOutput,
							}),
							transitions: { PATCH_READY: { target: "apply-element-patch", input: { patch: event() } } },
						},
						"apply-element-patch": {
							kind: "state",
							input: { patch: JsonPatch },
							action: script(tsxCommand, [workflowFile("scripts/apply-json-patch.ts")], {
								env: {
									INPUT_FILE: t`${item("write.chapter-production", "elementPath")}`,
									PATCH_JSON: t`${json(input("patch"))}`,
									OUTPUT_PATH: t`${item("write.chapter-production", "elementPath")}`,
									ALLOWED_PATH_PATTERN: "^/blocks/(?:-|[0-9]+)(?:/fallbackRequestId)?$",
									PATCH_MODE: "fallback",
								},
								artifacts: {
									elements: artifact(t`${item("write.chapter-production", "elementPath")}`, ElementPackage),
								},
								reply: PlanGateFeedbackOutput,
							}),
							transitions: { JSON_PATCH_APPLIED: "route-elements" },
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
								artifacts: {
									section: artifact(t`${item("write.chapter-production", "chapterPath")}`, SectionPackageOutput),
								},
							}),
							validate: script(tsxCommand, [workflowFile("guards/validate-chapter.ts")], {
								env: {
									WORK_JSON: t`${json(item("write.chapter-production"))}`,
									ELEMENTS_FILE: t`${item("write.chapter-production", "elementPath")}`,
									CHAPTER_FILE: t`${item("write.chapter-production", "chapterPath")}`,
								},
								reply: PlanGateFeedbackOutput,
							}),
							onReject: "resume",
							retries: 2,
							transitions: { CHAPTER_WRITTEN: "done" },
						},
						done: final(),
					},
					onDone: "assemble-document",
				}),
				"assemble-document": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/assemble-report-document.ts")], {
						env: {
							PLAN_FILE: artifactOf("plan.finalize.verification.assemble-plan"),
							EVIDENCE_FILE: artifactOf("research.assemble-evidence"),
							EXPERIENCE_FILE: artifactOf("plan.finalize.layout.experience-plan"),
							WORK_FILE: artifactOf("write.prepare-chapter-work"),
							OUTPUT_PATH: "artifacts/write/report-document.json",
						},
						artifacts: { document: artifact("artifacts/write/report-document.json", ReportDocumentOutput) },
						reply: DocumentManifestOutput,
					}),
					transitions: { DOCUMENT_READY: "production-manuscript-route" },
				},
				"production-manuscript-route": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/route-production-profile.ts")], {
						env: { PRODUCTION_POLISH: t`${arg("productionPolish")}`, PHASE: "manuscript" },
						reply: PlanGateFeedbackOutput,
					}),
					transitions: { POLISH_DRAFT: "render-html", POLISH_MANUSCRIPT: "manuscript-gate" },
				},
				"manuscript-gate": {
					kind: "state",
					onReenter: resume(
						"Review the updated manuscript against your previous requested corrections first. Preserve closed findings and do not introduce new preference-level criteria. PASS when no material evidence, coherence, or renderability defect remains; perfection is not required. Request only changes implementable with the chapter's verified beat evidence IDs and declared block schema.",
					),
					action: agent("report-engine-manuscript-gate", {
						task: t`Review the complete assembled manuscript across all chapters together. Production polish: ${arg("productionPolish")}. PASS when progression, chapter rhythm, repetition, transitions, evidence-backed copy, and visual composition materially work as one report; perfection is not required. Respect each verified beat's evidence boundary and the declared block schema. On REWRITE return only material, implementable corrections for affected chapter ids with owner layout|copy|elements and focused instructions.`,
						reads: [artifactOf("write.assemble-document"), artifactOf("write.prepare-chapter-work")],
						reply: ManuscriptGateFeedbackOutput,
					}),
					transitions: {
						PASS: "render-html",
						REWRITE: { target: "manuscript-rewrite-budget", input: { feedback: event() } },
					},
				},
				"manuscript-rewrite-budget": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script(tsxCommand, [workflowFile("scripts/manuscript-rewrite-budget.ts")], {
						env: {
							BUDGET_VISIT: t`${visitRef("write.manuscript-rewrite-budget")}`,
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
							PRODUCTION_POLISH: t`${arg("productionPolish")}`,
						},
						reply: ManuscriptGateFeedbackOutput,
					}),
					transitions: {
						RETRY: { target: "route-chapter-rework", input: { feedback: event() } },
						CONTINUE_WITH_WARNINGS: "render-html",
					},
				},
				"route-chapter-rework": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script(tsxCommand, [workflowFile("scripts/route-chapter-rework.ts")], {
						env: {
							WORK_FILE: artifactOf("write.prepare-chapter-work"),
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
							OUTPUT_PATH: "artifacts/write/chapter-rework.json",
						},
						artifacts: { work: artifact("artifacts/write/chapter-rework.json", SectionWorkItemsOutput) },
						reply: SectionWorkItemsOutput,
					}),
					transitions: { CHAPTER_REWORK_READY: { target: "chapter-production", input: { items: event("items") } } },
				},
				"render-html": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("engine/render-report.ts")], {
						env: {
							DOCUMENT_FILE: artifactOf("write.assemble-document"),
							OUTPUT_PATH: "artifacts/report.html",
							REVIEW_OUTPUT_PATH: "artifacts/write/render-review.json",
						},
						artifacts: {
							report: artifact("artifacts/report.html"),
							review: artifact("artifacts/write/render-review.json", RenderReviewOutput),
						},
						reply: RenderManifestOutput,
					}),
					validate: script(tsxCommand, [workflowFile("scripts/validate-render.ts")], {
						env: {
							HTML_FILE: artifactOf("write.render-html", { artifact: "report" }),
							REVIEW_FILE: artifactOf("write.render-html", { artifact: "review" }),
							OUTPUT_PATH: "artifacts/write/render-validation.json",
						},
						artifacts: { validation: artifact("artifacts/write/render-validation.json", RenderValidationOutput) },
						reply: RenderValidationOutput,
					}),
					retries: 0,
					transitions: { REPORT_RENDERED: "production-visual-route" },
				},
				"production-visual-route": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/route-production-profile.ts")], {
						env: { PRODUCTION_POLISH: t`${arg("productionPolish")}`, PHASE: "visual" },
						reply: PlanGateFeedbackOutput,
					}),
					transitions: { POLISH_DRAFT: "done", POLISH_VISUAL: "screenshot-report" },
				},
				"screenshot-report": {
					kind: "state",
					action: script(tsxCommand, [workflowFile("scripts/screenshot-report.ts")], {
						env: {
							HTML_FILE: artifactOf("write.render-html", { artifact: "report" }),
							OUTPUT_DIR: "artifacts/write/screenshots",
							OUTPUT_PATH: "artifacts/write/screenshots.json",
						},
						artifacts: { screenshots: artifact("artifacts/write/screenshots.json", ScreenshotManifestOutput) },
						reply: ScreenshotManifestOutput,
					}),
					transitions: { SCREENSHOTS_READY: "visual-qa" },
				},
				"visual-qa": {
					kind: "state",
					action: agent("report-engine-visual-qa", {
						task: t`Bounded visual QA pass ${visitRef("write.visual-qa")}. Production polish: ${arg("productionPolish")}. Read the deterministic render review and screenshot tile manifest, then open every referenced desktop/mobile tile. Verify that metric cards have real values, chart axes and labels are defined, tables/matrices are readable, no content is clipped, and mobile tiles remain legible. Treat deterministic PASS only as a technical prerequisite, not evidence of visual correctness. PASS with {reason:\"\",chapters:{},engineIssues:[]} only when presentable. Use CHAPTER_REWORK only for real chapter ids from the report plan. Never use pseudo-chapter ids such as frontmatter or sources; global navigation and renderer defects must use ENGINE_WARNING. Use ENGINE_WARNING for renderer-level issues. Never request another pass yourself. Write the declared QA artifact and finish with the matching event.`,
						reads: [artifactOf("write.render-html", { artifact: "review" }), artifactOf("write.screenshot-report")],
						artifacts: {
							review: artifact(
								t`artifacts/write/visual-qa-${visitRef("write.visual-qa")}.json`,
								ManuscriptGateFeedbackOutput,
							),
						},
						reply: ManuscriptGateFeedbackOutput,
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
					action: script(tsxCommand, [workflowFile("scripts/visual-rewrite-budget.ts")], {
						env: {
							QA_VISIT: t`${visitRef("write.visual-qa")}`,
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
							PRODUCTION_POLISH: t`${arg("productionPolish")}`,
						},
						reply: ManuscriptGateFeedbackOutput,
					}),
					transitions: {
						ALLOW_REWRITE: { target: "route-chapter-rework", input: { feedback: event() } },
						QA_LIMIT_REACHED: { target: "finalize-visual-warnings", input: { feedback: event() } },
					},
				},
				"finalize-visual-warnings": {
					kind: "state",
					input: { feedback: ManuscriptGateFeedback },
					action: script(tsxCommand, [workflowFile("scripts/finalize-visual-warnings.ts")], {
						env: {
							FEEDBACK_JSON: t`${json(input("feedback"))}`,
							OUTPUT_PATH: "artifacts/write/visual-qa-warnings.json",
						},
						artifacts: { warnings: artifact("artifacts/write/visual-qa-warnings.json", VisualWarningsOutput) },
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
