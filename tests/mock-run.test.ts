import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
	type AgentEffect,
	type ChartEvent,
	type MachineState,
	parseChartModuleSync,
	type RejectedEffect,
	start,
} from "@surprisal/hyperchart";
import {
	type AgentExecutor,
	ChartRuntime,
	type EmitCompletion,
	finalMachineFailureMessage,
	MemoryLogStore,
	terminalStateForFinalMachine,
} from "@surprisal/hyperchart/runtime";
import {
	BeatDraft,
	BeatPacket,
	EvidenceIndex,
	ReportDocument,
	SectionBeatWorkItems,
	SectionWorkItems,
} from "../contracts/index.js";

// Runs the real chart on the hyperchart runtime: real scripts, real guards, real
// schema registry, real renderer — only the agents are scripted. Fixtures model a
// tiny two-take, two-section, four-beat report; the t-beta research gate BLOCKs
// once so the gate-budget retry loop executes for real. Draft polish keeps the
// run browser-free (no screenshots / visual QA).

const PROMPT = "Mock run: verify the odyssey pipeline end to end.";

const TAKE_FIXTURES: Record<string, { url: string; claims: [string, string] }> = {
	"t-alpha": {
		url: "https://example.com/alpha",
		claims: ["Alpha throughput doubled between 2024 and 2025.", "Alpha adoption is concentrated in two providers."],
	},
	"t-beta": {
		url: "https://example.com/beta",
		claims: ["Beta failure rates fell by a third after hardening.", "Beta rollouts still lack independent audits."],
	},
};

const AGENDA = {
	takes: Object.fromEntries(
		Object.keys(TAKE_FIXTURES).map((id) => [
			id,
			{
				id,
				title: `${id} deep take`,
				question: `What does the evidence say about ${id}?`,
				rationale: `Closes the ${id.slice(2)} coverage gap in the skeleton.`,
				priority: "high",
				queries: [`${id} evidence 2025`],
				preferredSourceTypes: ["report"],
				acceptanceCriteria: ["Two corroborated findings with citations"],
				coverageTags: [id.slice(2)],
				depthBudget: 4,
				stopRule: "Stop after two corroborated findings are recorded.",
			},
		]),
	),
	stopRule: "Stop when every take holds two corroborated findings and no unresolved blocker remains in scope.",
};

const SKELETON = {
	thesis: "The mock pipeline produces a coherent evidence-led report.",
	readerQuestion: "Does the pipeline hold together end to end?",
	beats: [
		{ id: "sk-1", label: "Alpha shift", purpose: "Cover the alpha change", evidenceNeed: ["alpha data"], coverageTags: ["alpha"] },
		{ id: "sk-2", label: "Beta risks", purpose: "Cover the beta risks", evidenceNeed: ["beta data"], coverageTags: ["beta"] },
	],
	coverageTags: ["alpha", "beta"],
};

const emptyGateFeedback = { reason: "", missingEvidence: [], followupQueries: [], preserveFindings: [] };

const deepResearchFixture = (takeId: string) => {
	const fixture = TAKE_FIXTURES[takeId];
	if (!fixture) throw new Error(`no fixture for take ${takeId}`);
	const sourceId = `src-${takeId}`;
	return {
		takeId,
		answer: `Corroborated summary for ${takeId}.`,
		findings: fixture.claims.map((claim, index) => ({
			id: `f-${takeId}-${index + 1}`,
			claim,
			sourceIds: [sourceId],
			confidence: "high",
			tags: [],
		})),
		sources: [
			{ id: sourceId, title: `${takeId} source`, url: fixture.url, publisher: "Example Research", sourceType: "report" },
		],
		contradictions: [],
		gaps: [],
		blockers: [],
		acceptanceCriteria: [
			{ criterion: "Two corroborated findings with citations", satisfied: true, evidenceIds: [`f-${takeId}-1`] },
		],
	};
};

type HandlerResult = { files?: Record<string, unknown>; event: ChartEvent };
type Handler = (context: { keys: string[]; effect: AgentEffect }) => HandlerResult | Promise<HandlerResult>;

const parseInstancedPath = (path: string): { template: string; keys: string[] } => {
	const keys: string[] = [];
	const template = path
		.split(".")
		.map((segment) => {
			const hash = segment.indexOf("#");
			if (hash === -1) return segment;
			keys.push(segment.slice(hash + 1));
			return segment.slice(0, hash);
		})
		.join(".");
	return { template, keys };
};

class ScriptedAgentExecutor implements AgentExecutor {
	readonly rejects: string[] = [];
	private readonly lastEffect = new Map<string, AgentEffect>();

	constructor(
		private readonly handlers: Record<string, Handler>,
		private readonly workDir: string,
	) {}

	start(effect: AgentEffect, emit: EmitCompletion): void {
		this.lastEffect.set(effect.actionUid.state, effect);
		void this.dispatch(effect, emit);
	}

	// A reject means a scripted fixture failed a real guard or reply schema. Record it and
	// replay the same handler so the state exhausts its retry budget and the run terminates
	// deterministically; the test then prints every recorded rejection.
	reject(effect: RejectedEffect, emit: EmitCompletion): void {
		this.rejects.push(`${effect.actionUid.state}: ${effect.reason ?? JSON.stringify(effect.event)}`);
		const original = this.lastEffect.get(effect.actionUid.state);
		if (original) void this.dispatch(original, emit);
	}

	cancel(): void {}
	async dispose(): Promise<void> {}

	private async dispatch(effect: AgentEffect, emit: EmitCompletion): Promise<void> {
		const { template, keys } = parseInstancedPath(effect.actionUid.state);
		try {
			const handler = this.handlers[template];
			if (!handler) throw new Error(`no scripted handler for agent state ${template}`);
			const result = await handler({ keys, effect });
			for (const [name, value] of Object.entries(result.files ?? {})) {
				const declared = (effect.artifacts ?? []).find((artifact) => artifact.name === name);
				if (!declared) throw new Error(`state ${template} declares no artifact named ${name}`);
				const path = resolve(this.workDir, declared.path);
				mkdirSync(dirname(path), { recursive: true });
				writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
			}
			emit(result.event);
		} catch (error) {
			this.rejects.push(`${template}: scripted handler failed: ${error instanceof Error ? error.message : String(error)}`);
			emit({ type: "SCRIPTED_HANDLER_FAILED" });
		}
	}
}

test("the chart runs research → plan → write to done on scripted agents", async () => {
	const workDir = await mkdtemp(join(tmpdir(), "odyssey-mock-run-"));
	const readJson = (relative: string): unknown => JSON.parse(readFileSync(join(workDir, relative), "utf8"));
	const gateCalls = new Map<string, number>();

	const initialScout =
		(angleId: string): Handler =>
		() => ({
			files: {
				research: {
					angleId,
					angleTitle: `${angleId} scan`,
					bottomLine: [`Bounded ${angleId} context for the mock run.`],
					findings: [],
					sources: [],
					contradictions: [],
					gaps: [],
					suggestedDeepQuestions: [],
				},
			},
			event: { type: "SCOUTED" },
		});

	const handlers: Record<string, Handler> = {
		"research.initial-research.landscape.scout": initialScout("landscape"),
		"research.initial-research.evidence.scout": initialScout("evidence"),
		"research.initial-research.tensions.scout": initialScout("tensions"),

		"research.plan-research": () => ({
			files: { skeleton: SKELETON, agenda: AGENDA },
			event: { type: "DEEP_RESEARCH_PLANNED", output: AGENDA },
		}),

		"research.deep-research.scout": ({ keys, effect }) => {
			const takeId = keys[0] ?? "";
			const research = deepResearchFixture(takeId);
			const declared = effect.artifacts?.find((artifact) => artifact.name === "research");
			if (!declared) throw new Error("scout effect declares no research artifact");
			return {
				files: { research },
				event: {
					type: "SCOUTED",
					output: {
						takeId,
						artifactPath: declared.path,
						sourceCount: research.sources.length,
						evidenceCount: research.findings.length,
					},
				},
			};
		},

		// t-beta BLOCKs once so the gate-budget → scout retry lane runs for real.
		"research.deep-research.gate": ({ keys }) => {
			const takeId = keys[0] ?? "";
			const calls = (gateCalls.get(takeId) ?? 0) + 1;
			gateCalls.set(takeId, calls);
			if (takeId === "t-beta" && calls === 1)
				return {
					event: {
						type: "BLOCK",
						output: {
							reason: "Second corroborating source is missing for the beta findings.",
							missingEvidence: ["independent beta corroboration"],
							followupQueries: [],
							preserveFindings: ["f-t-beta-1"],
						},
					},
				};
			return { event: { type: "PASS", output: emptyGateFeedback } };
		},

		"plan.strategy.narrative-strategy": () => {
			const evidence = EvidenceIndex.parse(readJson("artifacts/research/evidence-index.json"));
			const byTake = (takeId: string) =>
				evidence.evidence.filter((entry) => entry.takeIds.includes(takeId)).map((entry) => entry.id);
			return {
				files: {
					strategy: {
						title: "Mock Pipeline Report",
						objective: "Prove the pipeline end to end on fixtures.",
						thesis: SKELETON.thesis,
						readerQuestion: SKELETON.readerQuestion,
						sections: [
							{ id: "s-one", title: "The alpha shift", purpose: "What changed", evidenceIds: byTake("t-alpha") },
							{ id: "s-two", title: "The beta risks", purpose: "What could break", evidenceIds: byTake("t-beta") },
						],
						exclusions: [],
						styleNotes: [],
					},
				},
				event: { type: "STRATEGY_READY" },
			};
		},

		"plan.strategy.strategy-gate": () => ({
			event: { type: "STRATEGY_PASS", output: { reason: "", instructions: [] } },
		}),

		"plan.beats.section-beats.generate": ({ keys }) => {
			const work = SectionBeatWorkItems.parse(readJson("artifacts/plan/section-beat-work-1.json"));
			const item = work.items[keys[0] ?? ""];
			if (!item) throw new Error(`no section beat work item for ${keys[0]}`);
			return {
				files: {
					section: {
						sectionId: item.sectionId,
						beats: item.evidence.slice(0, 2).map((entry, index) => ({
							id: `b-${item.sectionId}-${index + 1}`,
							sectionId: item.sectionId,
							narrativePurpose: `Make point ${index + 1} of ${item.section.title}`,
							takeaway: entry.claim,
							evidenceIds: [entry.id],
							dependsOnBeatIds: [],
						})),
					},
				},
				event: { type: "SECTION_BEATS_READY" },
			};
		},

		"plan.finalize.verification.verify-beats.verify": ({ keys }) => {
			const packet = BeatPacket.parse(readJson(`artifacts/plan/beat-packets-1/${keys[0]}.json`));
			return {
				files: {
					verified: {
						id: packet.beat.id,
						verdict: "supported",
						evidenceIds: packet.evidence.map((entry) => entry.id),
						confidence: 0.9,
						caveat: "",
						notes: [],
					},
				},
				event: { type: "VERIFIED" },
			};
		},

		"plan.finalize.layout.experience-plan": () => {
			const strategy = readJson("artifacts/plan/strategy-1.json") as { sections: Array<{ id: string }> };
			const candidate = BeatDraft.parse(readJson("artifacts/plan/beats-candidate.json"));
			const plan = {
				direction: "Calm essay flow with prose-led beats.",
				density: "balanced",
				globalRules: {
					maxBlocksPerBeat: 1,
					maxBlocksPerSection: 4,
					avoidRepeatedTypes: true,
					progressiveEvidenceDisclosure: false,
				},
				sections: Object.fromEntries(
					strategy.sections.map((section) => [
						section.id,
						{
							sectionId: section.id,
							layout: "essay",
							openingMode: "claim",
							openingClaim: "The evidence points one way.",
							handoff: "Which sets up the next chapter.",
							visualBudget: 2,
							beats: Object.fromEntries(
								candidate.beats
									.filter((beat) => beat.sectionId === section.id)
									.map((beat) => [
										beat.id,
										{ beatId: beat.id, presentation: "prose", visualIntent: "none", preferredOutputs: [] },
									]),
							),
						},
					]),
				),
			};
			return { files: { experience: plan }, event: { type: "EXPERIENCE_READY", output: plan } };
		},

		"write.chapter-production.plan-chapter": ({ keys }) => {
			const work = SectionWorkItems.parse(readJson("artifacts/write/chapter-work.json"));
			const item = work.items[keys[0] ?? ""];
			if (!item) throw new Error(`no chapter work item for ${keys[0]}`);
			const plan = {
				sectionId: item.sectionId,
				layout: "essay",
				openingClaim: "The evidence points one way.",
				handoff: "Which sets up the next chapter.",
				elementIntents: Object.fromEntries(
					item.beats.map((beat) => [beat.id, { beatId: beat.id, mode: "inline", output: "table", guaranteedUse: true }]),
				),
				visualRequests: {},
			};
			return { files: { plan }, event: { type: "CHAPTER_PLANNED", output: plan } };
		},

		"write.chapter-production.generate-elements": ({ keys }) => {
			const work = SectionWorkItems.parse(readJson("artifacts/write/chapter-work.json"));
			const item = work.items[keys[0] ?? ""];
			if (!item) throw new Error(`no chapter work item for ${keys[0]}`);
			return {
				files: {
					elements: {
						sectionId: item.sectionId,
						blocks: item.beats.map((beat) => ({
							id: `blk-${beat.id}`,
							beatId: beat.id,
							title: "Key point",
							purpose: "Anchor the beat takeaway inline.",
							evidenceIds: [...beat.evidenceIds],
							type: "callout",
							tone: "insight",
							body: beat.takeaway,
							bullets: [],
						})),
					},
				},
				event: { type: "ELEMENTS_READY" },
			};
		},

		"write.chapter-production.copywrite": ({ keys }) => {
			const work = SectionWorkItems.parse(readJson("artifacts/write/chapter-work.json"));
			const item = work.items[keys[0] ?? ""];
			if (!item) throw new Error(`no chapter work item for ${keys[0]}`);
			return {
				files: {
					section: {
						sectionId: item.sectionId,
						title: item.section.title,
						dek: `How ${item.section.title.toLowerCase()} plays out in the evidence.`,
						openingClaim: "The evidence points one way.",
						modules: item.beats.map((beat) => ({
							beatId: beat.id,
							headline: beat.takeaway,
							body: `${beat.takeaway} The cited records back this directly, and the callout carries the takeaway.`,
							presentation: "prose",
							layout: "prose",
							blockIds: [`blk-${beat.id}`],
							evidenceIds: [...beat.evidenceIds],
						})),
						handoff: "Which sets up the next chapter.",
					},
				},
				event: { type: "CHAPTER_WRITTEN" },
			};
		},
	};

	const parsed = parseChartModuleSync(resolve("chart.ts"));
	assert.ok(parsed.ok, parsed.ok ? "" : parsed.diagnostics.map((entry) => entry.message).join("\n"));
	const logStore = new MemoryLogStore();
	const executor = new ScriptedAgentExecutor(handlers, workDir);
	const runtime = new ChartRuntime({
		ast: parsed.ast,
		logStore,
		agentExecutor: executor,
		workDir,
		chartDir: resolve("."),
		schemaRegistry: parsed.schemaRegistry,
	});

	const machine = await Promise.race([
		start(runtime, { prompt: PROMPT, evidenceDepth: "skim", productionPolish: "draft" }),
		new Promise<MachineState>((_, rejectRace) =>
			setTimeout(() => rejectRace(new Error(`mock run timed out; rejects so far:\n${executor.rejects.join("\n")}`)), 240_000).unref(),
		),
	]);

	const log = await logStore.readAll();
	const failure = finalMachineFailureMessage(machine, log);
	assert.deepEqual(executor.rejects, [], `scripted agents were rejected:\n${executor.rejects.join("\n")}\n${failure ?? ""}`);
	assert.equal(terminalStateForFinalMachine(machine, log), "complete", failure ?? "run did not complete");

	// The gate-block retry lane actually ran: two gate reviews, second scout attempt on disk.
	assert.equal(gateCalls.get("t-beta"), 2);
	assert.equal(gateCalls.get("t-alpha"), 1);
	assert.ok(existsSync(join(workDir, "artifacts/research/deep/t-beta/research-2.json")));

	const evidence = EvidenceIndex.parse(readJson("artifacts/research/evidence-index.json"));
	assert.equal(evidence.counts.takes, 2);
	assert.equal(evidence.counts.sources, 2);

	const document = ReportDocument.parse(readJson("artifacts/write/report-document.json"));
	assert.equal(document.sections.length, 2);
	assert.equal(
		document.sections.reduce((count, section) => count + section.modules.length, 0),
		4,
	);

	const html = readFileSync(join(workDir, "artifacts/report.html"), "utf8");
	assert.ok(html.includes('data-odyssey="1"'), "rendered report is missing the Odyssey marker");
});
