import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ManuscriptGateFeedback, VisualWarnings } from "../contracts/index.js";
import { parseJsonText } from "../contracts/runtime.js";

const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", ManuscriptGateFeedback, "FEEDBACK_JSON");
const warnings = VisualWarnings.parse({ status: "done-with-warnings", ...feedback });
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/write/visual-qa-warnings.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(warnings, null, 2)}\n`);
console.log(JSON.stringify({ type: "WARNINGS_SAVED", output: { reason: feedback.reason, instructions: [] } }));
