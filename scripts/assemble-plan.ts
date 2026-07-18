import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BeatItems, EvidenceIndex, NarrativeStrategy, ReportPlan, VerifiedBeat, type BeatItems as BeatItemsType, type EvidenceIndex as EvidenceIndexType, type NarrativeStrategy as NarrativeStrategyType, type VerifiedBeat as VerifiedBeatType } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";
import { z } from "zod";

const read = <T>(path: string, schema: z.ZodType<T>): Promise<T> => parseJsonFile(path, schema);
const strategy = await read(process.env.STRATEGY_FILE ?? "", NarrativeStrategy);
const beatItems = await read(process.env.BEAT_ITEMS_FILE ?? "", BeatItems);
const evidence = await read(process.env.EVIDENCE_FILE ?? "", EvidenceIndex);
const verifiedFiles = parseJsonText(process.env.VERIFIED_FILES ?? "[]", z.array(z.string()), "VERIFIED_FILES");
const verified: VerifiedBeatType[] = [];
for (const file of verifiedFiles) verified.push(await parseJsonFile(file, VerifiedBeat));

const expectedById = new Map(Object.values(beatItems.items).map((beat) => [beat.id, beat]));
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
const seenIds = new Set<string>();
for (const beat of verified) {
  if (seenIds.has(beat.id)) throw new Error(`duplicate verified beat id: ${beat.id}`);
  seenIds.add(beat.id);
  const expected = expectedById.get(beat.id);
  if (!expected) throw new Error(`unexpected verified beat id: ${beat.id}`);
  for (const [field, value] of [["index", beat.index], ["sectionId", beat.sectionId], ["narrativePurpose", beat.narrativePurpose]] as const) {
    if (value !== expected[field]) throw new Error(`verified beat ${beat.id} changed ${field}`);
  }
  const allowedEvidence = new Set(expected.evidenceIds);
  for (const evidenceId of beat.evidenceIds) if (!allowedEvidence.has(evidenceId) || !evidenceIds.has(evidenceId)) throw new Error(`verified beat ${beat.id} references unapproved evidence ${evidenceId}`);
  if (beat.verdict !== "unsupported" && beat.evidenceIds.length === 0) throw new Error(`accepted verified beat ${beat.id} has no evidence`);
}
const missing = [...expectedById.keys()].filter((id) => !seenIds.has(id));
if (missing.length > 0) throw new Error(`missing verified beats: ${missing.join(", ")}`);
const accepted = verified.filter((beat) => beat.verdict !== "unsupported").sort((a, b) => a.index - b.index);
const output = ReportPlan.parse({
  title: strategy.title, objective: strategy.objective, thesis: strategy.thesis, readerQuestion: strategy.readerQuestion,
  sections: strategy.sections.map((section) => ({ ...section, beatIds: accepted.filter((beat) => beat.sectionId === section.id).map((beat) => beat.id) })),
  beats: accepted, exclusions: strategy.exclusions, styleNotes: strategy.styleNotes,
});
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/plan/report-plan.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "PLAN_ASSEMBLED", output: { artifactPath: process.env.OUTPUT_PATH ?? "artifacts/plan/report-plan.json", sectionCount: output.sections.length, beatCount: output.beats.length } }));
