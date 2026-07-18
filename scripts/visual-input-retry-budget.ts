import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PlanGateFeedback, VisualInput, VisualRequest } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";

const MAX_ATTEMPTS = 2;
const attempt = Number.parseInt(process.env.ATTEMPT ?? "0", 10);
const request = parseJsonText(process.env.REQUEST_JSON ?? "{}", VisualRequest, "REQUEST_JSON");
const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", PlanGateFeedback, "FEEDBACK_JSON");
const inputPath = resolve(process.cwd(), process.env.INPUT_FILE ?? "");
const reason = feedback.reason.length > 0 ? feedback.reason : "visual input validation or semantic gate failed";
if (Number.isFinite(attempt) && attempt < MAX_ATTEMPTS) {
  console.log(JSON.stringify({ type: "RETRY", output: { reason, instructions: [...feedback.instructions, `This is the final acquisition attempt (${attempt + 1} of ${MAX_ATTEMPTS}).`, "sourceIds must contain only source-record IDs with the s_ prefix; evidence IDs with the e_ prefix belong only in dataset.provenance[].evidenceId."] } }));
  process.exit(0);
}
const current = await parseJsonFile(inputPath, VisualInput);
const fallback = VisualInput.parse({ requestId: request.id, kind: request.kind, status: "not-found", sourceIds: [], sourceUrls: [], limitations: [`Visual acquisition exhausted after ${MAX_ATTEMPTS} attempts: ${reason}`], fallback: request.fallback ?? current.fallback ?? "prose" });
await writeFile(inputPath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ type: "FALLBACK", output: { reason: fallback.limitations[0], instructions: ["Use the declared deterministic fallback; do not retry acquisition."] } }));
