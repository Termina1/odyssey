import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ClosureReview, EvidenceIndex, ReportPlan } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { errorMessage } from "../guards/runtime.js";

const finish = async (type: string, reason: string, blockers: Array<Record<string, unknown>>): Promise<never> => {
	const output = ClosureReview.parse({ reason, blockers, instructions: reason ? [reason] : [] });
	if (process.env.OUTPUT_PATH) {
		const path = resolve(process.cwd(), process.env.OUTPUT_PATH);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, `${JSON.stringify(output, null, 2)}\n`);
	}
	process.stdout.write(`${JSON.stringify({ type, output })}\n`);
	process.exit(0);
};
try {
	const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
	const plan = process.env.PLAN_FILE ? await parseJsonFile(process.env.PLAN_FILE, ReportPlan) : undefined;
	const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
	const blockers: Array<Record<string, unknown>> = [];
	for (const entry of [...evidence.blockers, ...evidence.contradictions]) {
		if (
			["resolved", "downgraded", "removed"].includes(entry.status) &&
			(!entry.rationale.trim() ||
				entry.evidenceIds.length === 0 ||
				entry.evidenceIds.some((id) => !evidenceIds.has(id)))
		)
			blockers.push({
				id: entry.id,
				description: entry.description,
				status: "blocked",
				reason: "resolved register entries require rationale and existing evidence IDs",
			});
	}
	for (const section of plan?.sections ?? [])
		if (section.beatIds.length === 0)
			blockers.push({
				id: `section:${section.id}:empty`,
				description: `Required strategy section ${section.id} has no planned beats`,
				status: "blocked",
			});
	if (blockers.length > 0)
		await finish(
			"CLOSURE_BLOCKED",
			"Closure cannot PASS while the evidence register is malformed or a required section is empty",
			[...new Map(blockers.map((entry) => [entry.id, entry])).values()],
		);
	await finish("CLOSURE_VALID", "", []);
} catch (error) {
	await finish("CLOSURE_BLOCKED", `Cannot read closure inputs: ${errorMessage(error)}`, []);
}
