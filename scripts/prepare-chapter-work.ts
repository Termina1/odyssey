import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ExperiencePlan, ReportPlan, type SectionWorkItem, SectionWorkItems } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";

const plan = await parseJsonFile(process.env.PLAN_FILE ?? "", ReportPlan);
const experience = await parseJsonFile(process.env.EXPERIENCE_FILE ?? "", ExperiencePlan);
const beatsById = new Map(plan.beats.map((beat) => [beat.id, beat]));
const items: Record<string, SectionWorkItem> = {};
for (let index = 0; index < plan.sections.length; index += 1) {
	const section = plan.sections[index];
	const experienceSection = experience.sections[section.id];
	if (!experienceSection) throw new Error(`Missing experience section ${section.id}`);
	const beats = section.beatIds
		.map((id) => beatsById.get(id))
		.filter((beat): beat is ReportPlan["beats"][number] => Boolean(beat));
	items[section.id] = {
		sectionId: section.id,
		index,
		section,
		beats,
		experience: experienceSection,
		chapterPlanPath: `artifacts/write/chapters/${section.id}/chapter-plan.json`,
		visualCatalogPath: `artifacts/write/chapters/${section.id}/visual-inputs.json`,
		elementPath: `artifacts/write/chapters/${section.id}/elements.json`,
		chapterPath: `artifacts/write/chapters/${section.id}/chapter.json`,
	};
}
const output = SectionWorkItems.parse({ items, count: Object.keys(items).length });
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "CHAPTER_WORK_READY", output }));
