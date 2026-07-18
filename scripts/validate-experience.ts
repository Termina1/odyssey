import { ExperiencePlan, ReportPlan } from "../contracts/index.js";
import { parseJsonFile } from "../contracts/runtime.js";

const finish = (type: string, reason = ""): never => { console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } })); process.exit(0); };
let plan!: ReturnType<typeof ReportPlan.parse>;
let experience!: ReturnType<typeof ExperiencePlan.parse>;
try { [plan, experience] = await Promise.all([parseJsonFile(process.env.PLAN_FILE ?? "", ReportPlan), parseJsonFile(process.env.EXPERIENCE_FILE ?? "", ExperiencePlan)]); }
catch (error) { finish("EXPERIENCE_INVALID", `Cannot read authoritative inputs: ${error instanceof Error ? error.message : String(error)}`); }
const invalid = (reason: string): never => finish("EXPERIENCE_INVALID", reason);
const sectionIds = new Set(plan.sections.map((section) => section.id));
for (const sectionId of sectionIds) if (!experience.sections[sectionId]) invalid(`Missing experience section ${sectionId}`);
for (const [sectionId, section] of Object.entries(experience.sections)) {
  if (!sectionIds.has(sectionId) || section.sectionId !== sectionId) invalid(`Unknown or mismatched experience section ${sectionId}`);
  const planBeatIds = new Set(plan.sections.find((entry) => entry.id === sectionId)?.beatIds ?? []);
  for (const beatId of planBeatIds) if (!section.beats[beatId]) invalid(`Section ${sectionId} misses beat ${beatId}`);
  for (const beatId of Object.keys(section.beats)) if (!planBeatIds.has(beatId)) invalid(`Section ${sectionId} references unknown beat ${beatId}`);
  const visuallyPlanned = Object.values(section.beats).filter((beat) => beat.visualIntent !== "none").length;
  if (visuallyPlanned > section.visualBudget) invalid(`Section ${sectionId} exceeds visual budget`);
}
finish("EXPERIENCE_VALID");
