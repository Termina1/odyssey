import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { ElementPackage, ExperiencePlan, EvidenceIndex, ReportDocument, ReportPlan, SectionPackage, SectionWorkItems, VisualCatalog } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";

const plan = await parseJsonFile(process.env.PLAN_FILE ?? "", ReportPlan);
const evidence = await parseJsonFile(process.env.EVIDENCE_FILE ?? "", EvidenceIndex);
const experience = await parseJsonFile(process.env.EXPERIENCE_FILE ?? "", ExperiencePlan);
const work = await parseJsonFile(process.env.WORK_FILE ?? "", SectionWorkItems);
const visualInputs: Array<z.infer<typeof VisualCatalog>["inputs"][number]> = [];
const chapters: Array<z.infer<typeof SectionPackage>> = [];
const elements: Array<z.infer<typeof ElementPackage>> = [];
for (const section of plan.sections) {
  const item = work.items[section.id];
  if (!item) throw new Error(`Missing chapter work item for ${section.id}`);
  const [chapter, elementPackage, visualCatalog] = await Promise.all([
    parseJsonFile(item.chapterPath, SectionPackage),
    parseJsonFile(item.elementPath, ElementPackage),
    parseJsonFile(item.visualCatalogPath, VisualCatalog),
  ]);
  if (chapter.sectionId !== section.id || elementPackage.sectionId !== section.id || visualCatalog.sectionId !== section.id) throw new Error(`Chapter identity mismatch for ${section.id}`);
  chapters.push(chapter);
  elements.push(elementPackage);
  visualInputs.push(...visualCatalog.inputs);
}
const output = ReportDocument.parse({ version: "1", meta: { title: plan.title, objective: plan.objective, thesis: plan.thesis, readerQuestion: plan.readerQuestion }, plan, experience, sections: chapters, elements, evidence, visualInputs });
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "DOCUMENT_READY", output: { artifactPath: process.env.OUTPUT_PATH, sections: chapters.length, blocks: elements.reduce((sum, entry) => sum + entry.blocks.length, 0) } }));
