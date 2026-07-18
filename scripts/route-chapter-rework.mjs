import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const work = JSON.parse(await readFile(resolve(process.cwd(), process.env.WORK_FILE), "utf8"));
const feedback = JSON.parse(process.env.FEEDBACK_JSON ?? "{}");
const items = {};
for (const [sectionId, request] of Object.entries(feedback.chapters ?? {})) {
  const original = work.items?.[sectionId];
  if (!original) {
    console.warn(`Skipping non-chapter rework target: ${sectionId}`);
    continue;
  }
  items[sectionId] = {
    ...original,
    reworkFeedback: {
      owner: request.owner,
      reason: feedback.reason ?? "",
      instructions: request.instructions ?? [],
    },
  };
}
const output = { items, count: Object.keys(items).length };
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "CHAPTER_REWORK_READY", output }));
