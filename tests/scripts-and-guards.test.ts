import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { RESEARCH_CAPS } from "../contracts/constants.js";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const tsx = resolve(root, "node_modules/.bin/tsx");
const run = async (script: string, env: Record<string, string>): Promise<{ type: string; output: unknown }> => {
	const { stdout } = await execFileAsync(tsx, [resolve(root, script)], { cwd: root, env: { ...process.env, ...env } });
	return JSON.parse(stdout.trim()) as { type: string; output: unknown };
};

test("production profile routing selects the polish lanes and rejects unknown polish", async () => {
	assert.equal(
		(await run("scripts/route-production-profile.ts", { PRODUCTION_POLISH: "draft", PHASE: "manuscript" })).type,
		"POLISH_DRAFT",
	);
	assert.equal(
		(await run("scripts/route-production-profile.ts", { PRODUCTION_POLISH: "report", PHASE: "manuscript" })).type,
		"POLISH_MANUSCRIPT",
	);
	assert.equal(
		(await run("scripts/route-production-profile.ts", { PRODUCTION_POLISH: "release", PHASE: "visual" })).type,
		"POLISH_VISUAL",
	);
	assert.equal(
		(await run("scripts/route-production-profile.ts", { PRODUCTION_POLISH: "other", PHASE: "visual" })).type,
		"POLISH_INVALID",
	);
});

test("evidence depth agenda enforces the selected take cap and stop metadata", async () => {
	const work = await mkdtemp(join(tmpdir(), "odyssey-depth-cap-"));
	await writeFile(
		join(work, "skeleton.json"),
		JSON.stringify({
			thesis: "Thesis",
			readerQuestion: "Question",
			beats: [{ id: "b1", label: "Beat", purpose: "Purpose", evidenceNeed: [], coverageTags: ["coverage"] }],
			coverageTags: ["coverage"],
		}),
	);
	const takes = Object.fromEntries(
		Array.from({ length: RESEARCH_CAPS.skim.deepTakeCap + 1 }, (_, index) => [
			`take-${index}`,
			{
				id: `take-${index}`,
				title: "Take",
				question: "Question",
				rationale: "Rationale",
				priority: "low",
				queries: [],
				preferredSourceTypes: [],
				acceptanceCriteria: [],
				coverageTags: ["coverage"],
				depthBudget: 1,
				stopRule: "Stop at coverage",
			},
		]),
	);
	await writeFile(join(work, "agenda.json"), JSON.stringify({ takes, stopRule: "Stop when coverage is complete" }));
	await assert.rejects(
		execFileAsync(tsx, [resolve(root, "guards/validate-depth-agenda.ts")], {
			cwd: root,
			env: {
				...process.env,
				AGENDA_FILE: join(work, "agenda.json"),
				SKELETON_FILE: join(work, "skeleton.json"),
				EVIDENCE_DEPTH: "skim",
			},
		}),
	);
	const validTakes = Object.fromEntries(
		Object.entries(takes)
			.slice(0, RESEARCH_CAPS.skim.deepTakeCap)
			.map(([id, take]) => [
				id,
				{ ...take, stopRule: "Остановиться после выполнения критериев или исчерпания лимита." },
			]),
	);
	await writeFile(
		join(work, "agenda.json"),
		JSON.stringify({
			takes: validTakes,
			stopRule:
				"Остановить исследование, когда выполнены критерии каждого направления или исчерпаны установленные лимиты.",
		}),
	);
	const valid = await run("guards/validate-depth-agenda.ts", {
		AGENDA_FILE: join(work, "agenda.json"),
		SKELETON_FILE: join(work, "skeleton.json"),
		EVIDENCE_DEPTH: "skim",
	});
	assert.equal(valid.type, "DEPTH_AGENDA_VALID");
});

test("parallel section beat work targets only affected sections and assembles in strategy order", async () => {
	const work = await mkdtemp(join(tmpdir(), "odyssey-section-beats-"));
	const strategy = {
		title: "Report",
		objective: "Objective",
		thesis: "Thesis",
		readerQuestion: "Question",
		sections: [
			{ id: "s1-frame", title: "One", purpose: "Frame", evidenceIds: ["e1"] },
			{ id: "s2-model", title: "Two", purpose: "Model", evidenceIds: ["e2"] },
		],
		exclusions: [],
		styleNotes: [],
	};
	const evidence = {
		evidence: [
			{ id: "e1", claim: "Claim one", sourceIds: [], confidence: "high", caveat: "", tags: [], takeIds: [] },
			{ id: "e2", claim: "Claim two", sourceIds: [], confidence: "high", caveat: "", tags: [], takeIds: [] },
		],
		sources: [],
		contradictions: [],
		gaps: [],
		blockers: [],
		counts: { takes: 0, evidence: 2, sources: 0 },
	};
	const current = {
		beats: [
			{
				id: "beat-s1",
				sectionId: "s1-frame",
				narrativePurpose: "Frame",
				takeaway: "Old one",
				evidenceIds: ["e1"],
				dependsOnBeatIds: [],
			},
			{
				id: "beat-s2",
				sectionId: "s2-model",
				narrativePurpose: "Model",
				takeaway: "Keep two",
				evidenceIds: ["e2"],
				dependsOnBeatIds: ["beat-s1"],
			},
		],
	};
	await writeFile(join(work, "strategy.json"), JSON.stringify(strategy));
	await writeFile(join(work, "evidence.json"), JSON.stringify(evidence));
	await writeFile(join(work, "beats.json"), JSON.stringify(current));
	const prepared = await run("scripts/prepare-section-beat-work.ts", {
		STRATEGY_FILE: join(work, "strategy.json"),
		EVIDENCE_FILE: join(work, "evidence.json"),
		CURRENT_BEATS_FILE: join(work, "beats.json"),
		FEEDBACK_JSON: JSON.stringify({ reason: "repair s1", instructions: ["Change beat-s1 only"] }),
		OUTPUT_PATH: join(work, "section-work.json"),
	});
	assert.equal(prepared.type, "SECTION_BEAT_WORK_READY");
	const sectionWork = JSON.parse(await readFile(join(work, "section-work.json"), "utf8")) as {
		items: Record<string, unknown>;
	};
	assert.deepEqual(Object.keys(sectionWork.items), ["s1-frame"]);
	const replacement = {
		sectionId: "s1-frame",
		beats: [{ ...current.beats[0], takeaway: "New one" }],
	};
	await writeFile(join(work, "s1.json"), JSON.stringify(replacement));
	assert.equal(
		(
			await run("guards/validate-section-beats.ts", {
				WORK_JSON: JSON.stringify(sectionWork.items["s1-frame"]),
				DRAFT_FILE: join(work, "s1.json"),
			})
		).type,
		"SECTION_BEATS_VALID",
	);
	await writeFile(
		join(work, "invalid-s1.json"),
		JSON.stringify({ ...replacement, beats: [{ ...replacement.beats[0], id: "renamed-beat" }] }),
	);
	await assert.rejects(
		run("guards/validate-section-beats.ts", {
			WORK_JSON: JSON.stringify(sectionWork.items["s1-frame"]),
			DRAFT_FILE: join(work, "invalid-s1.json"),
		}),
	);
	await run("scripts/assemble-section-beats.ts", {
		SECTION_FILES: JSON.stringify([join(work, "s1.json")]),
		STRATEGY_FILE: join(work, "strategy.json"),
		CURRENT_BEATS_FILE: join(work, "beats.json"),
		OUTPUT_PATH: join(work, "assembled.json"),
	});
	const assembled = JSON.parse(await readFile(join(work, "assembled.json"), "utf8")) as typeof current;
	assert.deepEqual(
		assembled.beats.map((beat) => [beat.id, beat.takeaway]),
		[
			["beat-s1", "New one"],
			["beat-s2", "Keep two"],
		],
	);
	const invalidDependencies = structuredClone(assembled);
	invalidDependencies.beats[1].dependsOnBeatIds = ["missing-beat"];
	await writeFile(join(work, "invalid-dependencies.json"), JSON.stringify(invalidDependencies));
	const routed = await run("scripts/route-beats.ts", {
		DRAFT_FILE: join(work, "invalid-dependencies.json"),
		EVIDENCE_FILE: join(work, "evidence.json"),
		STRATEGY_FILE: join(work, "strategy.json"),
	});
	assert.equal(routed.type, "BEATS_INVALID");
	assert.match((routed.output as { reason: string }).reason, /missing-beat/);
});

test("closure preserves evidenced unresolved limitations but rejects empty required sections", async () => {
	const work = await mkdtemp(join(tmpdir(), "odyssey-closure-semantics-"));
	const evidence = {
		evidence: [{ id: "e1", claim: "Claim", sourceIds: [], confidence: "high", caveat: "", tags: [], takeIds: [] }],
		sources: [],
		contradictions: [],
		gaps: [],
		blockers: [
			{
				id: "limit1",
				description: "Irreducible observability limit",
				severity: "high",
				status: "unresolved",
				dependsOn: [],
				rationale: "Must be disclosed rather than fabricated away",
				evidenceIds: ["e1"],
				takeIds: [],
			},
		],
		counts: { takes: 0, evidence: 1, sources: 0 },
	};
	const beat = {
		id: "b1",
		index: 0,
		sectionId: "s1",
		narrativePurpose: "Explain",
		verdict: "supported",
		takeaway: "Claim",
		evidenceIds: ["e1"],
		confidence: 0.8,
		caveat: "",
		notes: [],
		dependsOnBeatIds: [],
	};
	const plan = {
		title: "Report",
		objective: "Objective",
		thesis: "Thesis",
		readerQuestion: "Question",
		sections: [{ id: "s1", title: "Section", purpose: "Purpose", evidenceIds: ["e1"], beatIds: ["b1"] }],
		beats: [beat],
		exclusions: [],
		styleNotes: [],
		blockers: evidence.blockers,
		contradictions: [],
		unsupportedBeatIds: [],
		beatDependencies: { b1: [] },
	};
	await writeFile(join(work, "evidence.json"), JSON.stringify(evidence));
	await writeFile(join(work, "plan.json"), JSON.stringify(plan));
	assert.equal(
		(
			await run("scripts/check-closure.ts", {
				EVIDENCE_FILE: join(work, "evidence.json"),
				PLAN_FILE: join(work, "plan.json"),
				OUTPUT_PATH: join(work, "closure.json"),
			})
		).type,
		"CLOSURE_VALID",
	);
	plan.sections[0].beatIds = [];
	plan.beats = [];
	await writeFile(join(work, "plan-empty.json"), JSON.stringify(plan));
	assert.equal(
		(
			await run("scripts/check-closure.ts", {
				EVIDENCE_FILE: join(work, "evidence.json"),
				PLAN_FILE: join(work, "plan-empty.json"),
			})
		).type,
		"CLOSURE_BLOCKED",
	);
});

test("take guard binds the completion to the mapped take and declared artifact", async () => {
	const work = await mkdtemp(join(tmpdir(), "odyssey-take-guard-"));
	const research = {
		takeId: "expected",
		answer: "Answer",
		findings: [{ id: "f1", claim: "Claim", sourceIds: ["s1"], confidence: "high", tags: [] }],
		sources: [
			{ id: "s1", title: "Source", url: "https://example.com/source", publisher: "Example", sourceType: "official" },
		],
		contradictions: [],
		gaps: [],
		acceptanceCriteria: [{ criterion: "Criterion", satisfied: true, evidenceIds: ["f1"] }],
	};
	await writeFile(join(work, "take.json"), JSON.stringify(research));
	const invoke = (takeId: string) =>
		spawnSync(tsx, [resolve(root, "guards/validate-take.ts")], {
			cwd: work,
			env: {
				...process.env,
				EVIDENCE_DEPTH: "skim",
				EXPECTED_TAKE_ID: "expected",
				ARTIFACT_FILE: "take.json",
			},
			input: JSON.stringify({
				type: "SCOUTED",
				output: { artifactPath: "take.json", takeId, sourceCount: 1, evidenceCount: 1 },
			}),
			encoding: "utf8",
		});
	assert.equal(invoke("expected").status, 0);
	const wrong = invoke("wrong");
	assert.notEqual(wrong.status, 0);
	assert.match(wrong.stderr, /expected take expected/);
});

test("chapter-plan guard rejects invalid intent plans with a nonzero outcome", async () => {
	const work = await mkdtemp(join(tmpdir(), "odyssey-chapter-plan-"));
	const beat = {
		id: "b1",
		index: 0,
		sectionId: "s1",
		narrativePurpose: "Purpose",
		verdict: "supported",
		takeaway: "Takeaway",
		evidenceIds: ["e1"],
		confidence: 1,
		caveat: "",
		notes: [],
		dependsOnBeatIds: [],
	};
	const workItem = {
		sectionId: "s1",
		index: 0,
		section: { id: "s1", title: "Section", purpose: "Purpose", evidenceIds: ["e1"], beatIds: ["b1"] },
		beats: [beat],
		experience: {
			sectionId: "s1",
			layout: "essay",
			openingMode: "claim",
			openingClaim: "Claim",
			handoff: "Next",
			visualBudget: 0,
			beats: { b1: { beatId: "b1", presentation: "prose", visualIntent: "none", preferredOutputs: [] } },
		},
		chapterPlanPath: "chapter-plan.json",
		visualCatalogPath: "visual-catalog.json",
		elementPath: "elements.json",
		chapterPath: "chapter.json",
	};
	const evidence = {
		evidence: [{ id: "e1", claim: "Claim", sourceIds: [], confidence: "high", caveat: "", tags: [], takeIds: [] }],
		sources: [],
		contradictions: [],
		gaps: [],
		blockers: [],
		counts: { takes: 0, evidence: 1, sources: 0 },
	};
	const invalidPlan = {
		sectionId: "wrong",
		layout: "essay",
		openingClaim: "Claim",
		handoff: "Next",
		elementIntents: { b1: { beatId: "b1", mode: "inline", output: "prose", guaranteedUse: true } },
		visualRequests: {},
	};
	await writeFile(join(work, "chapter-plan.json"), JSON.stringify(invalidPlan));
	await writeFile(join(work, "evidence.json"), JSON.stringify(evidence));
	await assert.rejects(
		execFileAsync(tsx, [resolve(root, "guards/validate-chapter-plan.ts")], {
			cwd: work,
			env: {
				...process.env,
				WORK_JSON: JSON.stringify(workItem),
				CHAPTER_PLAN_FILE: "chapter-plan.json",
				EVIDENCE_FILE: "evidence.json",
			},
		}),
	);
});

test("production polish enforces manuscript and visual QA caps", async () => {
	const feedback = JSON.stringify({
		reason: "needs work",
		chapters: { s1: { owner: "copy", instructions: ["tighten"] } },
		engineIssues: [],
	});
	const manuscriptDraft = await run("scripts/manuscript-rewrite-budget.ts", {
		BUDGET_VISIT: "1",
		FEEDBACK_JSON: feedback,
		PRODUCTION_POLISH: "draft",
	});
	assert.equal(manuscriptDraft.type, "CONTINUE_WITH_WARNINGS");
	assert.equal(
		(
			await run("scripts/manuscript-rewrite-budget.ts", {
				BUDGET_VISIT: "3",
				FEEDBACK_JSON: feedback,
				PRODUCTION_POLISH: "report",
			})
		).type,
		"CONTINUE_WITH_WARNINGS",
	);
	assert.equal(
		(
			await run("scripts/manuscript-rewrite-budget.ts", {
				BUDGET_VISIT: "2",
				FEEDBACK_JSON: feedback,
				PRODUCTION_POLISH: "release",
			})
		).type,
		"RETRY",
	);
	assert.equal(
		(
			await run("scripts/visual-rewrite-budget.ts", {
				QA_VISIT: "1",
				FEEDBACK_JSON: feedback,
				PRODUCTION_POLISH: "draft",
			})
		).type,
		"QA_LIMIT_REACHED",
	);
	assert.equal(
		(
			await run("scripts/visual-rewrite-budget.ts", {
				QA_VISIT: "1",
				FEEDBACK_JSON: feedback,
				PRODUCTION_POLISH: "report",
			})
		).type,
		"ALLOW_REWRITE",
	);
	assert.equal(
		(
			await run("scripts/visual-rewrite-budget.ts", {
				QA_VISIT: "2",
				FEEDBACK_JSON: feedback,
				PRODUCTION_POLISH: "report",
			})
		).type,
		"QA_LIMIT_REACHED",
	);
	assert.equal(
		(
			await run("scripts/visual-rewrite-budget.ts", {
				QA_VISIT: "2",
				FEEDBACK_JSON: feedback,
				PRODUCTION_POLISH: "release",
			})
		).type,
		"ALLOW_REWRITE",
	);
});

test("bounded patch lanes preserve unrelated data and reject unsupported paths", async () => {
	const work = await mkdtemp(join(tmpdir(), "odyssey-port-patch-"));
	const candidate = {
		beats: [{ id: "b1", sectionId: "s1", narrativePurpose: "Purpose", takeaway: "Takeaway", evidenceIds: ["e_old"] }],
	};
	const evidence = {
		evidence: [
			{ id: "e_new", claim: "Claim", sourceIds: [], confidence: "high", caveat: "", tags: [], takeIds: ["take"] },
		],
		sources: [],
		contradictions: [],
		gaps: [],
		blockers: [],
		counts: { takes: 1, evidence: 1, sources: 0 },
	};
	const patch = { beatId: "b1", operations: [{ op: "replace", path: "/evidenceIds", value: ["e_new"] }] };
	await writeFile(join(work, "candidate.json"), JSON.stringify(candidate));
	await writeFile(join(work, "evidence.json"), JSON.stringify(evidence));
	const result = await execFileAsync(tsx, [resolve(root, "scripts/apply-beat-patch.ts")], {
		cwd: work,
		env: {
			...process.env,
			CANDIDATE_FILE: "candidate.json",
			PATCH_JSON: JSON.stringify(patch),
			EVIDENCE_FILE: "evidence.json",
			OUTPUT_PATH: "patched.json",
		},
	});
	assert.match(result.stdout, /BEAT_PATCH_APPLIED/);
	const patched = JSON.parse(await readFile(join(work, "patched.json"), "utf8"));
	assert.deepEqual(patched.beats[0].evidenceIds, ["e_new"]);
	assert.equal(patched.beats[0].takeaway, "Takeaway");
	await writeFile(join(work, "elements.json"), JSON.stringify({ sectionId: "s1", blocks: [] }));
	const fallbackBlock = {
		id: "fallback",
		beatId: "b1",
		type: "callout",
		title: "Unavailable",
		purpose: "Represent the declared fallback",
		evidenceIds: ["e_new"],
		fallbackRequestId: "v1",
		tone: "scope",
		body: "The requested visual was not found.",
		bullets: [],
	};
	const fallbackPatch = await execFileAsync(tsx, [resolve(root, "scripts/apply-json-patch.ts")], {
		cwd: work,
		env: {
			...process.env,
			INPUT_FILE: "elements.json",
			PATCH_JSON: JSON.stringify([{ op: "add", path: "/blocks/-", value: fallbackBlock }]),
			OUTPUT_PATH: "elements-patched.json",
			ALLOWED_PATH_PATTERN: "^/blocks/(?:-|[0-9]+)(?:/fallbackRequestId)?$",
			PATCH_MODE: "fallback",
		},
	});
	assert.match(fallbackPatch.stdout, /JSON_PATCH_APPLIED/);
	const patchedElements = JSON.parse(await readFile(join(work, "elements-patched.json"), "utf8"));
	assert.equal(patchedElements.blocks[0].fallbackRequestId, "v1");
	await assert.rejects(
		execFileAsync(tsx, [resolve(root, "scripts/apply-json-patch.ts")], {
			cwd: work,
			env: {
				...process.env,
				INPUT_FILE: "patched.json",
				PATCH_JSON: JSON.stringify([{ op: "replace", path: "/beats/0/takeaway", value: "bad" }]),
				OUTPUT_PATH: "bad.json",
				ALLOWED_PATH_PATTERN: "^/blocks/(?:-|[0-9]+)(?:/fallbackRequestId)?$",
				PATCH_MODE: "fallback",
			},
		}),
	);
});
