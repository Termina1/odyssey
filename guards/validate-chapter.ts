import { ElementPackage, SectionPackage, SectionWorkItem } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

let work!: ReturnType<typeof SectionWorkItem.parse>;
let elements!: ReturnType<typeof ElementPackage.parse>;
let chapter!: ReturnType<typeof SectionPackage.parse>;
try {
	work = parseJsonText(requiredEnv("WORK_JSON"), SectionWorkItem, "WORK_JSON");
	[elements, chapter] = await Promise.all([
		parseJsonFile(requiredEnv("ELEMENTS_FILE"), ElementPackage),
		parseJsonFile(requiredEnv("CHAPTER_FILE"), SectionPackage),
	]);
} catch (error) {
	reject(`Cannot read chapter inputs: ${errorMessage(error)}`);
}
if (chapter.sectionId !== work.sectionId) reject("chapter package sectionId mismatch");
const expectedBeats = new Set(work.beats.map((beat) => beat.id));
const blockIds = new Set(elements.blocks.map((block) => block.id));
const seen = new Set<string>();
for (const module of chapter.modules) {
	if (!expectedBeats.has(module.beatId) || seen.has(module.beatId))
		reject(`unknown or duplicate module beat ${module.beatId}`);
	seen.add(module.beatId);
	for (const blockId of module.blockIds)
		if (!blockIds.has(blockId)) reject(`module ${module.beatId} references unknown block ${blockId}`);
	const expectedEvidence = new Set(work.beats.find((beat) => beat.id === module.beatId)?.evidenceIds ?? []);
	for (const id of module.evidenceIds)
		if (!expectedEvidence.has(id)) reject(`module ${module.beatId} references unknown evidence ${id}`);
}
for (const beatId of expectedBeats) if (!seen.has(beatId)) reject(`chapter misses beat ${beatId}`);
accept("CHAPTER_VALID");
