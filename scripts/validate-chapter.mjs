import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const finish = (type, reason = "") => console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } }));
const invalid = (reason) => { finish("CHAPTER_INVALID", reason); process.exit(0); };
let work, elements, chapter;
try {
  work = JSON.parse(process.env.WORK_JSON);
  [elements, chapter] = await Promise.all([process.env.ELEMENTS_FILE, process.env.CHAPTER_FILE].map((path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse)));
} catch (error) { invalid(`Cannot read chapter inputs: ${error instanceof Error ? error.message : String(error)}`); }
if (chapter.sectionId !== work.sectionId) invalid("chapter package sectionId mismatch");
const expectedBeats = new Set((work.beats ?? []).map((beat) => beat.id));
const blockIds = new Set((elements.blocks ?? []).map((block) => block.id));
const seen = new Set();
for (const module of chapter.modules ?? []) {
  if (!expectedBeats.has(module.beatId) || seen.has(module.beatId)) invalid(`unknown or duplicate module beat ${module.beatId}`);
  seen.add(module.beatId);
  for (const blockId of module.blockIds ?? []) if (!blockIds.has(blockId)) invalid(`module ${module.beatId} references unknown block ${blockId}`);
  const expectedEvidence = new Set((work.beats.find((beat) => beat.id === module.beatId)?.evidenceIds) ?? []);
  for (const id of module.evidenceIds ?? []) if (!expectedEvidence.has(id)) invalid(`module ${module.beatId} references unknown evidence ${id}`);
}
for (const beatId of expectedBeats) if (!seen.has(beatId)) invalid(`chapter misses beat ${beatId}`);
finish("CHAPTER_VALID");
