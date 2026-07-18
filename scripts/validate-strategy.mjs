import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const invalid = (reason) => {
	console.log(JSON.stringify({ type: "STRATEGY_INVALID", output: { reason, instructions: [reason] } }));
	process.exit(0);
};

let strategy;
let evidence;
try {
	[strategy, evidence] = await Promise.all([
		readJson(process.env.STRATEGY_FILE),
		readJson(process.env.EVIDENCE_FILE),
	]);
} catch (error) {
	invalid(`Cannot read authoritative strategy inputs: ${error instanceof Error ? error.message : String(error)}`);
}

if (typeof strategy.thesis !== "string" || !strategy.thesis.trim()) invalid("strategy has no thesis");
if (typeof strategy.readerQuestion !== "string" || !strategy.readerQuestion.trim()) invalid("strategy has no reader question");
if (!Array.isArray(strategy.sections) || strategy.sections.length === 0) invalid("strategy has no sections");

const evidenceIds = new Set((evidence.evidence ?? []).map((entry) => entry.id));
const sectionIds = new Set();
for (const section of strategy.sections) {
	if (!section || typeof section.id !== "string" || !section.id) invalid("strategy section without id");
	if (sectionIds.has(section.id)) invalid(`duplicate strategy section id ${section.id}`);
	sectionIds.add(section.id);
	if (!Array.isArray(section.evidenceIds) || section.evidenceIds.length === 0) {
		invalid(`strategy section ${section.id} has no evidence allocation`);
	}
	for (const evidenceId of section.evidenceIds) {
		if (!evidenceIds.has(evidenceId)) invalid(`strategy section ${section.id} references unknown evidence ${evidenceId}`);
	}
}

console.log(JSON.stringify({ type: "STRATEGY_VALID", output: { reason: "", instructions: [] } }));
