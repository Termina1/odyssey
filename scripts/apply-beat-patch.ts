import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BeatDraft, BeatPatch, EvidenceIndex, PlanGateFeedbackOutput } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const candidate = await parseJsonFile(requiredEnv("CANDIDATE_FILE"), BeatDraft);
const patch = process.env.PATCH_JSON
	? parseJsonText(process.env.PATCH_JSON, BeatPatch, "PATCH_JSON")
	: await parseJsonFile(requiredEnv("PATCH_FILE"), BeatPatch);
const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
const beat = candidate.beats.find((entry) => entry.id === patch.beatId);
if (!beat) throw new Error(`unknown beat ${patch.beatId}`);
for (const operation of patch.operations) {
	if (operation.value.some((id) => !evidenceIds.has(id)))
		throw new Error(`patch references unknown evidence for ${patch.beatId}`);
	beat.evidenceIds = [...operation.value];
}
const output = BeatDraft.parse(candidate);
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
if (process.env.SNAPSHOT_PATH) {
	const snapshotPath = resolve(process.cwd(), process.env.SNAPSHOT_PATH);
	await mkdir(dirname(snapshotPath), { recursive: true });
	await writeFile(snapshotPath, `${JSON.stringify(output, null, 2)}\n`);
}
console.log(
	JSON.stringify({
		type: "BEAT_PATCH_APPLIED",
		output: PlanGateFeedbackOutput.parse({ reason: "", instructions: [] }),
	}),
);
