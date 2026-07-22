import { z } from "zod";
import { emit, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const attempt = Number.parseInt(requiredEnv("ATTEMPT"), 10);
const limit = Number.parseInt(requiredEnv("LIMIT"), 10);
if (!Number.isFinite(attempt) || !Number.isFinite(limit)) throw new Error("ATTEMPT and LIMIT must be integers");
const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", z.record(z.string(), z.unknown()), "FEEDBACK_JSON");
if (attempt <= limit) emit("RETRY", feedback);
else {
	const reason = typeof feedback.reason === "string" ? feedback.reason : "";
	emit("PROCEED", {
		...feedback,
		reason:
			`Gate-block budget exhausted after ${limit} reworked attempts; proceeding with the current artifact. ${reason}`.trim(),
	});
}
