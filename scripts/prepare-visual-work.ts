import { resolve } from "node:path";
import { ChapterPlan, EvidenceIndex, VisualPacket, type VisualWorkItem, VisualWorkItems } from "../contracts/index.js";
import { emit, parseJsonFile, requiredEnv, writeJsonArtifact } from "../contracts/runtime.js";

const plan = await parseJsonFile(requiredEnv("CHAPTER_PLAN_FILE"), ChapterPlan);
const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
const packetDir = requiredEnv("PACKET_DIR");
const evidenceById = new Map(evidence.evidence.map((entry) => [entry.id, entry]));
const sourcesById = new Map(evidence.sources.map((entry) => [entry.id, entry]));
const items: Record<string, VisualWorkItem> = {};
for (const [id, request] of Object.entries(plan.visualRequests)) {
	const selectedEvidence = request.evidenceIds.flatMap((evidenceId) => {
		const entry = evidenceById.get(evidenceId);
		if (!entry) throw new Error(`visual request ${id} references unknown evidence ${evidenceId}`);
		return [entry];
	});
	const selectedSources = [...new Set(selectedEvidence.flatMap((entry) => entry.sourceIds))].flatMap((sourceId) => {
		const source = sourcesById.get(sourceId);
		return source === undefined ? [] : [source];
	});
	const packet = VisualPacket.parse({ request, evidence: selectedEvidence, sources: selectedSources });
	const packetPath = resolve(process.cwd(), packetDir, `${id}.json`);
	await writeJsonArtifact(packetPath, packet);
	items[id] = { ...request, packetPath };
}
const output = VisualWorkItems.parse({ items, count: Object.keys(items).length });
await writeJsonArtifact(requiredEnv("OUTPUT_PATH"), output);
emit("VISUAL_WORK_READY", output);
