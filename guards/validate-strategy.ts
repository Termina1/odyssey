import { EvidenceIndex, NarrativeStrategy } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

let strategy!: ReturnType<typeof NarrativeStrategy.parse>;
let evidence!: ReturnType<typeof EvidenceIndex.parse>;
try {
	[strategy, evidence] = await Promise.all([
		parseJsonFile(requiredEnv("STRATEGY_FILE"), NarrativeStrategy),
		parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex),
	]);
} catch (error) {
	reject(`Cannot read authoritative strategy inputs: ${errorMessage(error)}`);
}
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
for (const section of strategy.sections) {
	for (const evidenceId of section.evidenceIds)
		if (!evidenceIds.has(evidenceId))
			reject(`strategy section ${section.id} references unknown evidence ${evidenceId}`);
}
accept("STRATEGY_VALID");
