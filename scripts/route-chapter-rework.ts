import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ManuscriptGateFeedback, SectionWorkItems } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const work = await parseJsonFile(requiredEnv("WORK_FILE"), SectionWorkItems);
const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", ManuscriptGateFeedback, "FEEDBACK_JSON");
const items = Object.fromEntries(
	Object.entries(feedback.chapters).flatMap(([sectionId, request]) => {
		const original = work.items[sectionId];
		if (!original) {
			console.warn(`Skipping non-chapter rework target: ${sectionId}`);
			return [];
		}
		return [
			[
				sectionId,
				{
					...original,
					reworkFeedback: { owner: request.owner, reason: feedback.reason, instructions: request.instructions },
				},
			],
		];
	}),
);
const output = SectionWorkItems.parse({ items, count: Object.keys(items).length });
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "CHAPTER_REWORK_READY", output }));
