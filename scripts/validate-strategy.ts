import { EvidenceIndex, NarrativeStrategy } from "../contracts/index.js";
import { parseJsonFile } from "../contracts/runtime.js";

const invalid = (reason: string): never => {
	console.log(JSON.stringify({ type: "STRATEGY_INVALID", output: { reason, instructions: [reason] } }));
	process.exit(0);
};
let strategy!: ReturnType<typeof NarrativeStrategy.parse>;
let evidence!: ReturnType<typeof EvidenceIndex.parse>;
try {
	[strategy, evidence] = await Promise.all([
		parseJsonFile(process.env.STRATEGY_FILE ?? "", NarrativeStrategy),
		parseJsonFile(process.env.EVIDENCE_FILE ?? "", EvidenceIndex),
	]);
} catch (error) {
	invalid(`Cannot read authoritative strategy inputs: ${error instanceof Error ? error.message : String(error)}`);
}
if (!strategy.thesis.trim()) invalid("strategy has no thesis");
if (!strategy.readerQuestion.trim()) invalid("strategy has no reader question");
if (strategy.sections.length === 0) invalid("strategy has no sections");
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
const sectionIds = new Set<string>();
for (const section of strategy.sections) {
	if (sectionIds.has(section.id)) invalid(`duplicate strategy section id ${section.id}`);
	sectionIds.add(section.id);
	if (section.evidenceIds.length === 0) invalid(`strategy section ${section.id} has no evidence allocation`);
	for (const evidenceId of section.evidenceIds)
		if (!evidenceIds.has(evidenceId))
			invalid(`strategy section ${section.id} references unknown evidence ${evidenceId}`);
}
console.log(JSON.stringify({ type: "STRATEGY_VALID", output: { reason: "", instructions: [] } }));
