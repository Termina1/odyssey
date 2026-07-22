import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { RenderReview, RenderValidationOutput } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";

const review = await parseJsonFile(requiredEnv("REVIEW_FILE"), RenderReview);
const htmlPath = resolve(process.cwd(), requiredEnv("HTML_FILE"));
try {
	await access(htmlPath);
} catch {
	throw new Error(`render HTML is missing: ${htmlPath}`);
}
const output = RenderValidationOutput.parse({
	artifactPath: process.env.HTML_FILE,
	pass: review.pass,
	findings: review.findings.length,
});
if (process.env.OUTPUT_PATH) {
	const path = resolve(process.cwd(), process.env.OUTPUT_PATH);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(output, null, 2)}\n`);
}
if (!review.pass) {
	const summary =
		review.findings.map((finding) => `${finding.severity}: ${finding.message}`).join("; ") ||
		"render review failed without findings";
	process.stderr.write(`Render validation failed: ${summary}\n`);
	process.exit(1);
}
console.log(JSON.stringify({ type: "RENDER_VALIDATED", output }));
