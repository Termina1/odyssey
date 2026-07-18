import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const feedback = JSON.parse(process.env.FEEDBACK_JSON ?? "{}");
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/write/visual-qa-warnings.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ status: "done-with-warnings", ...feedback }, null, 2)}\n`);
console.log(JSON.stringify({ type: "WARNINGS_SAVED", output: { reason: feedback.reason ?? "", instructions: [] } }));
