import { EvidenceIndex, EvidenceRegisterPatch } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

let evidence!: ReturnType<typeof EvidenceIndex.parse>;
let patch!: ReturnType<typeof EvidenceRegisterPatch.parse>;
try {
	[evidence, patch] = await Promise.all([
		parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex),
		parseJsonFile(requiredEnv("PATCH_FILE"), EvidenceRegisterPatch),
	]);
} catch (error) {
	reject(`Cannot read evidence register patch: ${errorMessage(error)}`);
}
const entries = new Map([...evidence.contradictions, ...evidence.blockers].map((entry) => [entry.id, entry]));
const seen = new Set<string>();
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
for (const operation of patch) {
	if (seen.has(operation.id)) reject(`duplicate register patch id ${operation.id}`);
	seen.add(operation.id);
	const entry = entries.get(operation.id) ?? reject(`unknown register entry ${operation.id}`);
	if (entry.description !== operation.description) reject(`register description changed for ${operation.id}`);
	for (const id of operation.evidenceIds)
		if (!evidenceIds.has(id)) reject(`register patch ${operation.id} references unknown evidence ${id}`);
}
accept("REGISTER_PATCH_VALID");
