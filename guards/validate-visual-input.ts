import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { PlanGateFeedbackOutput, VisualInput, VisualPacket } from "../contracts/index.js";
import { parseJsonFile, requiredEnv, writeJsonArtifact } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

const feedbackFile = process.env.FEEDBACK_FILE;

const writeFeedback = async (reason: string): Promise<void> => {
	if (!feedbackFile) return;
	const feedback = PlanGateFeedbackOutput.parse({ reason, instructions: reason ? [reason] : [] });
	await writeJsonArtifact(feedbackFile, feedback);
};

const invalid = async (reason: string): Promise<never> => {
	await writeFeedback(reason);
	return reject(reason);
};

let packet!: ReturnType<typeof VisualPacket.parse>;
let input!: ReturnType<typeof VisualInput.parse>;
try {
	[packet, input] = await Promise.all([
		parseJsonFile(requiredEnv("PACKET_FILE"), VisualPacket),
		parseJsonFile(requiredEnv("INPUT_FILE"), VisualInput),
	]);
} catch (error) {
	await invalid(`Cannot read visual input: ${errorMessage(error)}`);
}
const request = packet.request;
if (input.requestId !== request.id) await invalid(`requestId mismatch for ${request.id}`);
if (input.kind !== request.kind) await invalid(`kind mismatch for ${request.id}`);
const requestedEvidence = new Set(request.evidenceIds);
const allowedSourceIds = new Set(packet.sources.map((source) => source.id));
for (const sourceId of input.sourceIds)
	if (!allowedSourceIds.has(sourceId)) await invalid(`visual input references unrelated source record ${sourceId}`);
for (const entry of input.dataset?.provenance ?? [])
	if (entry.evidenceId !== undefined && !requestedEvidence.has(entry.evidenceId))
		await invalid(`dataset provenance references unrelated evidence ${entry.evidenceId}`);
if (input.status === "usable" && (request.kind === "image" || request.kind === "screenshot")) {
	const localPath = input.image?.localPath ?? (await invalid("validated image input is unavailable"));
	try {
		await access(resolve(process.cwd(), localPath));
	} catch {
		await invalid(`image file is missing: ${localPath}`);
	}
}
await writeFeedback("");
accept("VISUAL_INPUT_VALID");
