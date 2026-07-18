import { BeatPacket, VerifiedBeat } from "../contracts/index.js";
import { parseJsonFile } from "../contracts/runtime.js";

const invalid = (reason: string): never => {
	console.log(JSON.stringify({ type: "VERIFICATION_INVALID", output: { reason, instructions: [reason] } }));
	process.exit(0);
};
let verified!: ReturnType<typeof VerifiedBeat.parse>;
let packet!: ReturnType<typeof BeatPacket.parse>;
try {
	[verified, packet] = await Promise.all([
		parseJsonFile(process.env.VERIFIED_FILE ?? "", VerifiedBeat),
		parseJsonFile(process.env.PACKET_FILE ?? "", BeatPacket),
	]);
} catch (error) {
	invalid(`Cannot read authoritative verification inputs: ${error instanceof Error ? error.message : String(error)}`);
}
const beat = packet.beat;
for (const [field, value] of [
	["id", verified.id],
	["index", verified.index],
	["sectionId", verified.sectionId],
	["narrativePurpose", verified.narrativePurpose],
] as const)
	if (value !== beat[field]) invalid(`verification changed ${field}`);
const allowedEvidence = new Set(packet.evidence.map((entry) => entry.id));
for (const evidenceId of verified.evidenceIds)
	if (!allowedEvidence.has(evidenceId)) invalid(`verification invented evidence id ${evidenceId}`);
if (verified.verdict !== "unsupported" && verified.evidenceIds.length === 0)
	invalid("accepted verification has no evidence");
console.log(JSON.stringify({ type: "VERIFICATION_VALID", output: { reason: "", instructions: [] } }));
