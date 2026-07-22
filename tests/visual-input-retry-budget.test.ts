import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { VisualInput } from "../contracts/index.js";

const execFileAsync = promisify(execFile);
const script = resolve("scripts/visual-input-retry-budget.ts");
const tsx = resolve("node_modules/.bin/tsx");
const request = {
	id: "visual-1",
	sectionId: "section-1",
	beatId: "beat-1",
	kind: "dataset" as const,
	purpose: "Show the comparison",
	question: "How do values differ?",
	evidenceIds: ["e_1"],
	preferredOutput: "bar" as const,
	requirements: [],
	fallback: "prose" as const,
	intent: "dataset-backed" as const,
	required: true,
};

for (const existing of [undefined, "not-json"] as const) {
	test(`exhausted acquisition writes fallback when the failed artifact is ${existing === undefined ? "missing" : "invalid"}`, async () => {
		const workDir = await mkdtemp(join(tmpdir(), "odyssey-visual-budget-"));
		const inputFile = join(workDir, "artifacts", "write", "chapters", "section-1", "visual.json");
		const validationFeedbackFile = join(workDir, "validation-feedback.json");
		try {
			await writeFile(
				validationFeedbackFile,
				JSON.stringify({ reason: "cross-artifact mismatch", instructions: ["fix the mismatched IDs"] }),
				"utf8",
			);
			if (existing !== undefined) {
				await mkdir(join(workDir, "artifacts", "write", "chapters", "section-1"), { recursive: true });
				await writeFile(inputFile, existing, "utf8");
			}
			const { stdout } = await execFileAsync(tsx, [script], {
				cwd: workDir,
				env: {
					...process.env,
					ATTEMPT: "2",
					REQUEST_JSON: JSON.stringify(request),
					FEEDBACK_JSON: JSON.stringify({ reason: "", instructions: [] }),
					VALIDATION_FEEDBACK_FILE: validationFeedbackFile,
					INPUT_FILE: inputFile,
				},
			});
			const completion = JSON.parse(stdout.trim()) as { type: string };
			assert.equal(completion.type, "FALLBACK");
			const fallback = VisualInput.parse(JSON.parse(await readFile(inputFile, "utf8")));
			assert.equal(fallback.status, "not-found");
			assert.equal(fallback.fallback, request.fallback);
			assert.match(fallback.limitations[0] ?? "", /cross-artifact mismatch/);
		} finally {
			await rm(workDir, { recursive: true, force: true });
		}
	});
}
