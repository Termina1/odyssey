import { VisualInput } from "../contracts/index.js";
import { emit, parseJsonFile, requiredEnv } from "../contracts/runtime.js";

const input = await parseJsonFile(requiredEnv("INPUT_FILE"), VisualInput);
if (input.status === "not-found")
	emit("NOT_FOUND_FALLBACK", {
		reason: `Visual input ${input.requestId} is an honest not-found; using its declared ${input.fallback} fallback.`,
		instructions: [],
	});
else emit("NEEDS_GATE", { reason: "", instructions: [] });
