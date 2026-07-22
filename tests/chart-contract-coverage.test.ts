import assert from "node:assert/strict";
import { accessSync, constants, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import test from "node:test";
import { parseChartModuleSync } from "@surprisal/hyperchart";

const parsed = parseChartModuleSync(resolve("chart.ts"));
if (!parsed.ok) throw new Error(parsed.diagnostics.map((entry) => entry.message).join("\n"));
type NormalizedSchema = { runtimeContract?: { id: string; version: string } };
type NormalizedArtifact = { shape?: NormalizedSchema };

test("every JSON reply and shaped artifact has a registered exact runtime contract", () => {
	let replies = 0;
	let shapedArtifacts = 0;
	let unshapedArtifacts = 0;
	for (const [statePath, state] of Object.entries(parsed.ast.states)) {
		if (state.kind !== "state") continue;
		const repliesToCheck = [
			state.action.reply,
			state.validate?.kind === "script" ? state.validate.reply : undefined,
		].filter((reply) => reply !== undefined) as NormalizedSchema[];
		for (const reply of repliesToCheck) {
			replies += 1;
			const identity = reply.runtimeContract;
			assert.ok(identity, `${statePath} reply is missing runtimeContract`);
			assert.ok(parsed.schemaRegistry.get(identity), `${statePath} reply contract is not registered`);
		}
		const actionArtifacts = (state.action.kind === "user" ? {} : (state.action.artifacts ?? {})) as Record<
			string,
			NormalizedArtifact
		>;
		const guardArtifacts = (state.validate?.kind === "script" ? (state.validate.artifacts ?? {}) : {}) as Record<
			string,
			NormalizedArtifact
		>;
		for (const [name, artifact] of Object.entries({ ...actionArtifacts, ...guardArtifacts })) {
			if (artifact.shape === undefined) {
				unshapedArtifacts += 1;
				continue;
			}
			shapedArtifacts += 1;
			const identity = artifact.shape.runtimeContract;
			assert.ok(identity, `${statePath}.${name} shaped artifact is missing runtimeContract`);
			assert.ok(parsed.schemaRegistry.get(identity), `${statePath}.${name} artifact contract is not registered`);
		}
	}
	assert.equal(replies, 46);
	assert.equal(shapedArtifacts, 36);
	assert.equal(unshapedArtifacts, 1, "only the self-contained HTML report artifact should be unshaped");
});

test("every TypeScript action and guard uses the workflow-local tsx executable", () => {
	const expectedCommand = resolve("node_modules/.bin/tsx");
	accessSync(expectedCommand, constants.X_OK);
	let scripts = 0;
	for (const [statePath, state] of Object.entries(parsed.ast.states)) {
		if (state.kind !== "state") continue;
		for (const invocation of [state.action, state.validate]) {
			if (invocation?.kind !== "script") continue;
			scripts += 1;
			assert.equal(invocation.command, expectedCommand, `${statePath} must not depend on PATH for tsx`);
			assert.equal(isAbsolute(invocation.command), true, `${statePath} script command must be absolute`);
		}
	}
	assert.equal(scripts, 41);
});

test("agent prompts mirror hard caps and frozen producer constraints", () => {
	const agent = (name: string) => readFileSync(resolve("agents", `${name}.md`), "utf8");
	assert.match(agent("report-engine-planner"), /skim.*4 takes.*4 sources.*8 findings/);
	assert.match(agent("report-engine-research-scout"), /skim.*4 sources.*8 findings/);
	assert.match(agent("report-engine-beat-verifier"), /ONLY the verdict payload/);
	assert.match(agent("report-engine-beat-verifier"), /never restate, copy, or edit/);
	assert.match(agent("report-engine-section-beat-planner"), /exactly one report section/);
	assert.match(agent("report-engine-element-generator"), /Every acquired chapter-local visual input is guaranteed-use/);
	assert.match(agent("report-engine-manuscript-gate"), /draft.*0 rounds.*report.*2 rounds.*release.*3 rounds/);
	assert.match(agent("report-engine-visual-qa"), /draft.*0 passes.*report.*1 pass.*release.*2 passes/);
	const source = readFileSync(resolve("chart.ts"), "utf8");
	assert.match(source, /Evidence depth: \$\{arg\("evidenceDepth"\)\}\\nTake key/);
	assert.equal((source.match(/Production polish: \$\{arg\("productionPolish"\)\}/g) ?? []).length, 2);
});

test("validation scripts are guards on producer states, never standalone actions", () => {
	const expected = new Set([
		"research.plan-research",
		"research.deep-research.scout",
		"research.evidence-register-review",
		"plan.strategy.narrative-strategy",
		"plan.beats.section-beats.generate",
		"plan.finalize.verification.verify-beats.verify",
		"plan.finalize.layout.experience-plan",
		"write.chapter-production.plan-chapter",
		"write.chapter-production.visual-inputs.acquire",
		"write.chapter-production.copywrite",
		"write.render-html",
	]);
	const actual = new Set<string>();
	for (const [statePath, state] of Object.entries(parsed.ast.states)) {
		if (state.kind !== "state") continue;
		if (state.action.kind === "script") {
			assert.doesNotMatch(state.action.command + state.action.args.join(" "), /guards\/validate-|scripts\/validate-/);
		}
		if (state.validate?.kind === "script") {
			actual.add(statePath);
			assert.ok(
				Object.keys(state.validate.env ?? {}).length > 0,
				`${statePath} guard must declare its inputs through env`,
			);
			assert.notEqual(state.retries, undefined, `${statePath} guard must have a finite rejection budget`);
			assert.ok((state.retries ?? Number.POSITIVE_INFINITY) <= 2, `${statePath} guard retry budget is too high`);
		}
	}
	assert.deepEqual(actual, expected);
	assert.equal(Object.keys(parsed.ast.states).length, 86);
});

test("bounded repair lanes are reachable and revalidate without regeneration", () => {
	const transitionTarget = (statePath: string, event: string): string | undefined => {
		const state = parsed.ast.states[statePath];
		return state?.kind === "state" ? state.transitions[event]?.target : undefined;
	};
	const agendaState = parsed.ast.states["research.plan-research"];
	assert.equal(agendaState?.kind, "state");
	assert.equal(agendaState?.kind === "state" ? agendaState.retries : undefined, 2);
	const takeState = parsed.ast.states["research.deep-research.scout"];
	assert.equal(takeState?.kind === "state" ? takeState.onReject : undefined, "resume");
	assert.equal(transitionTarget("research.plan-research", "DEEP_RESEARCH_PLANNED"), "deep-research");
	assert.equal(transitionTarget("research.deep-research.gate", "BLOCK"), "gate-budget");
	assert.equal(transitionTarget("research.deep-research.gate-budget", "RETRY"), "scout");
	assert.equal(transitionTarget("research.deep-research.gate-budget", "PROCEED"), "done");
	assert.equal(transitionTarget("research.assemble-evidence", "REGISTER_CLEAN"), "done");
	assert.equal(transitionTarget("research.assemble-evidence", "REVIEW_REQUIRED"), "evidence-register-review");
	assert.equal(transitionTarget("plan.strategy.strategy-gate", "STRATEGY_BLOCK"), "strategy-budget");
	assert.equal(transitionTarget("plan.strategy.strategy-budget", "PROCEED"), "done");
	assert.equal(transitionTarget("plan.beats.prepare-section-beats", "SECTION_REPAIR_EXHAUSTED"), "planning-invalid");
	assert.equal(transitionTarget("write.chapter-production.plan-chapter", "CHAPTER_PLANNED"), "prepare-visual-work");
	assert.equal(transitionTarget("write.chapter-production.visual-inputs.acquire", "ACQUIRED"), "triage");
	assert.equal(transitionTarget("write.chapter-production.visual-inputs.triage", "NOT_FOUND_FALLBACK"), "done");
	assert.equal(transitionTarget("write.chapter-production.visual-inputs.triage", "NEEDS_GATE"), "gate");
	assert.equal(transitionTarget("plan.strategy.strategy-gate", "STRATEGY_PASS"), "done");
	assert.equal(transitionTarget("plan.beats.prepare-section-beats", "SECTION_BEAT_WORK_READY"), "section-beats");
	assert.equal(transitionTarget("plan.beats.section-beats.generate", "SECTION_BEATS_READY"), "done");
	assert.equal(transitionTarget("plan.beats.assemble-section-beats", "SECTION_BEATS_ASSEMBLED"), "route-beats");
	assert.equal(transitionTarget("plan.beats.route-beats", "BEATS_VALID"), "prepare-beats");
	assert.equal(transitionTarget("plan.beats.route-beats", "BEAT_PATCH_REQUIRED"), "beat-patch");
	assert.equal(transitionTarget("plan.beats.route-beats", "BEATS_INVALID"), "prepare-section-beats");
	assert.equal(transitionTarget("plan.beats.apply-beat-patch", "BEAT_PATCH_APPLIED"), "route-beats");
	assert.equal(transitionTarget("write.chapter-production.generate-elements", "ELEMENTS_READY"), "route-elements");
	assert.equal(transitionTarget("write.chapter-production.route-elements", "ELEMENTS_PATCH_REQUIRED"), "element-patch");
	assert.equal(
		transitionTarget("write.chapter-production.apply-element-patch", "JSON_PATCH_APPLIED"),
		"route-elements",
	);
});

test("state and map inputs remain ordinary schemas", () => {
	let inputs = 0;
	for (const [statePath, state] of Object.entries(parsed.ast.states)) {
		if ((state.kind !== "state" && state.kind !== "map") || state.input === undefined) continue;
		for (const [name, schema] of Object.entries(state.input)) {
			inputs += 1;
			assert.equal(schema.runtimeContract, undefined, `${statePath}.${name} input must not be an exact contract`);
		}
	}
	assert.equal(inputs, 23);
});
