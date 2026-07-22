import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { EvidenceIndex, EvidenceManifestOutput, EvidenceRegisterPatch } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";

const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
const patch = await parseJsonFile(requiredEnv("PATCH_FILE"), EvidenceRegisterPatch);
const byId = new Map([...evidence.contradictions, ...evidence.blockers].map((entry) => [entry.id, entry]));
for (const operation of patch) {
	const entry = byId.get(operation.id);
	if (!entry) throw new Error(`unknown register entry ${operation.id}`);
	entry.status = operation.status;
	entry.rationale = operation.rationale;
	entry.evidenceIds = [...new Set(operation.evidenceIds)].sort();
}
const output = EvidenceIndex.parse(evidence);
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
const manifest = EvidenceManifestOutput.parse({ artifactPath: process.env.OUTPUT_PATH, ...output.counts });
console.log(JSON.stringify({ type: "REGISTER_PATCH_APPLIED", output: manifest }));
