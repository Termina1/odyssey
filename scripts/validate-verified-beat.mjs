import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const invalid = (reason) => {
	console.log(JSON.stringify({ type: "VERIFICATION_INVALID", output: { reason, instructions: [reason] } }));
	process.exit(0);
};

let verified;
let packet;
try {
	[verified, packet] = await Promise.all([
		readJson(process.env.VERIFIED_FILE),
		readJson(process.env.PACKET_FILE),
	]);
} catch (error) {
	invalid(`Cannot read authoritative verification inputs: ${error instanceof Error ? error.message : String(error)}`);
}

const beat = packet.beat;
if (!beat || typeof beat !== "object") invalid("packet has no beat");
for (const field of ["id", "index", "sectionId", "narrativePurpose"]) {
	if (verified[field] !== beat[field]) invalid(`verification changed ${field}`);
}
const allowedEvidence = new Set((packet.evidence ?? []).map((entry) => entry.id));
if (!Array.isArray(verified.evidenceIds)) invalid("verification evidenceIds must be an array");
for (const evidenceId of verified.evidenceIds) {
	if (!allowedEvidence.has(evidenceId)) invalid(`verification invented evidence id ${evidenceId}`);
}
if (verified.verdict !== "unsupported" && verified.evidenceIds.length === 0) {
	invalid("accepted verification has no evidence");
}

console.log(JSON.stringify({ type: "VERIFICATION_VALID", output: { reason: "", instructions: [] } }));
