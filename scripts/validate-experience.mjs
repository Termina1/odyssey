import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const finish = (type, reason = "") => console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } }));
let plan, experience;
try {
  [plan, experience] = await Promise.all([
    readJson(process.env.PLAN_FILE),
    readJson(process.env.EXPERIENCE_FILE),
  ]);
} catch (error) {
  finish("EXPERIENCE_INVALID", `Cannot read authoritative inputs: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}
const invalid = (reason) => { finish("EXPERIENCE_INVALID", reason); process.exit(0); };
const sectionIds = new Set((plan.sections ?? []).map((section) => section.id));
for (const sectionId of sectionIds) if (!experience.sections?.[sectionId]) invalid(`Missing experience section ${sectionId}`);
for (const [sectionId, section] of Object.entries(experience.sections ?? {})) {
  if (!sectionIds.has(sectionId) || section.sectionId !== sectionId) invalid(`Unknown or mismatched experience section ${sectionId}`);
  const planBeatIds = new Set((plan.sections.find((entry) => entry.id === sectionId)?.beatIds) ?? []);
  for (const beatId of planBeatIds) if (!section.beats?.[beatId]) invalid(`Section ${sectionId} misses beat ${beatId}`);
  for (const beatId of Object.keys(section.beats ?? {})) if (!planBeatIds.has(beatId)) invalid(`Section ${sectionId} references unknown beat ${beatId}`);
  const visuallyPlanned = Object.values(section.beats ?? {}).filter((beat) => beat.visualIntent !== "none").length;
  if (visuallyPlanned > (section.visualBudget ?? 0)) invalid(`Section ${sectionId} exceeds visual budget`);
}
finish("EXPERIENCE_VALID");
