import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const invalid = (reason) => {
	console.log(JSON.stringify({ type: "BEATS_INVALID", output: { reason, instructions: [reason] } }));
	process.exit(0);
};

let draft;
let evidence;
let strategy;
try {
	[draft, evidence, strategy] = await Promise.all([
		readJson(process.env.DRAFT_FILE),
		readJson(process.env.EVIDENCE_FILE),
		readJson(process.env.STRATEGY_FILE),
	]);
} catch (error) {
	invalid(`Cannot read authoritative beat inputs: ${error instanceof Error ? error.message : String(error)}`);
}

if (!Array.isArray(draft.beats)) invalid("beats must be an array");
const evidenceIds = new Set((evidence.evidence ?? []).map((entry) => entry.id));
const sectionIds = new Set((strategy.sections ?? []).map((entry) => entry.id));
const beatIds = new Set();
for (const beat of draft.beats) {
	if (!beat || typeof beat.id !== "string" || !beat.id) invalid("beat without id");
	if (beatIds.has(beat.id)) invalid(`duplicate beat id ${beat.id}`);
	beatIds.add(beat.id);
	if (!sectionIds.has(beat.sectionId)) invalid(`beat ${beat.id} references unknown section ${beat.sectionId}`);
	if (typeof beat.takeaway !== "string" || !beat.takeaway.trim()) invalid(`beat ${beat.id} has empty takeaway`);
	if (!Array.isArray(beat.evidenceIds) || beat.evidenceIds.length === 0) invalid(`beat ${beat.id} has no evidenceIds`);
	for (const evidenceId of beat.evidenceIds) {
		if (!evidenceIds.has(evidenceId)) invalid(`beat ${beat.id} references unknown evidence ${evidenceId}`);
	}
}

console.log(JSON.stringify({ type: "BEATS_VALID", output: { reason: "", instructions: [] } }));
