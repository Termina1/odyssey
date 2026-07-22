import { BeatPacket, BeatVerdict } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

let verdict!: ReturnType<typeof BeatVerdict.parse>;
let packet!: ReturnType<typeof BeatPacket.parse>;
try {
	[verdict, packet] = await Promise.all([
		parseJsonFile(requiredEnv("VERIFIED_FILE"), BeatVerdict),
		parseJsonFile(requiredEnv("PACKET_FILE"), BeatPacket),
	]);
} catch (error) {
	reject(`Cannot read authoritative verification inputs: ${errorMessage(error)}`);
}
if (verdict.id !== packet.beat.id) reject(`verdict is for beat ${verdict.id}, expected ${packet.beat.id}`);
const allowedEvidence = new Set(packet.evidence.map((entry) => entry.id));
for (const evidenceId of verdict.evidenceIds)
	if (!allowedEvidence.has(evidenceId)) reject(`verification invented evidence id ${evidenceId}`);
accept("VERIFICATION_VALID");
