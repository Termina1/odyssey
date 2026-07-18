import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const [plan, evidence, experience, work] = await Promise.all([
  readJson(process.env.PLAN_FILE),
  readJson(process.env.EVIDENCE_FILE),
  readJson(process.env.EXPERIENCE_FILE),
  readJson(process.env.WORK_FILE),
]);
const visualInputs = [];
const chapters = [];
const elements = [];
for (const section of plan.sections ?? []) {
  const item = work.items?.[section.id];
  if (!item) throw new Error(`Missing chapter work item for ${section.id}`);
  const [chapter, elementPackage, visualCatalog] = await Promise.all([readJson(item.chapterPath), readJson(item.elementPath), readJson(item.visualCatalogPath)]);
  if (chapter.sectionId !== section.id || elementPackage.sectionId !== section.id || visualCatalog.sectionId !== section.id) throw new Error(`Chapter identity mismatch for ${section.id}`);
  chapters.push(chapter);
  elements.push(elementPackage);
  visualInputs.push(...(visualCatalog.inputs ?? []));
}
const output = {
  version: "1",
  meta: { title: plan.title, objective: plan.objective, thesis: plan.thesis, readerQuestion: plan.readerQuestion },
  plan,
  experience,
  sections: chapters,
  elements,
  evidence,
  visualInputs,
};
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "DOCUMENT_READY", output: { artifactPath: process.env.OUTPUT_PATH, sections: chapters.length, blocks: elements.reduce((sum, entry) => sum + (entry.blocks?.length ?? 0), 0) } }));
