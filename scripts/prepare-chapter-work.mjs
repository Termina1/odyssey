import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const plan = await readJson(process.env.PLAN_FILE);
const experience = await readJson(process.env.EXPERIENCE_FILE);
const beatsById = new Map((plan.beats ?? []).map((beat) => [beat.id, beat]));
const items = {};
for (let index = 0; index < (plan.sections ?? []).length; index += 1) {
  const section = plan.sections[index];
  const experienceSection = experience.sections?.[section.id];
  if (!experienceSection) throw new Error(`Missing experience section ${section.id}`);
  items[section.id] = {
    sectionId: section.id,
    index,
    section,
    beats: (section.beatIds ?? []).map((id) => beatsById.get(id)).filter(Boolean),
    experience: experienceSection,
    chapterPlanPath: `artifacts/write/chapters/${section.id}/chapter-plan.json`,
    visualCatalogPath: `artifacts/write/chapters/${section.id}/visual-inputs.json`,
    elementPath: `artifacts/write/chapters/${section.id}/elements.json`,
    chapterPath: `artifacts/write/chapters/${section.id}/chapter.json`,
  };
}
const output = { items, count: Object.keys(items).length };
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "CHAPTER_WORK_READY", output }));
