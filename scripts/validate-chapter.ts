import { ElementPackage, SectionPackage, SectionWorkItem } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";

const finish = (type: string, reason = ""): never => {
	console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } }));
	process.exit(0);
};
const invalid = (reason: string): never => finish("CHAPTER_INVALID", reason);
let work!: ReturnType<typeof SectionWorkItem.parse>;
let elements!: ReturnType<typeof ElementPackage.parse>;
let chapter!: ReturnType<typeof SectionPackage.parse>;
try {
	work = parseJsonText(process.env.WORK_JSON ?? "", SectionWorkItem, "WORK_JSON");
	[elements, chapter] = await Promise.all([
		parseJsonFile(process.env.ELEMENTS_FILE ?? "", ElementPackage),
		parseJsonFile(process.env.CHAPTER_FILE ?? "", SectionPackage),
	]);
} catch (error) {
	invalid(`Cannot read chapter inputs: ${error instanceof Error ? error.message : String(error)}`);
}
if (chapter.sectionId !== work.sectionId) invalid("chapter package sectionId mismatch");
const expectedBeats = new Set(work.beats.map((beat) => beat.id));
const blockIds = new Set(elements.blocks.map((block) => block.id));
const seen = new Set<string>();
for (const module of chapter.modules) {
	if (!expectedBeats.has(module.beatId) || seen.has(module.beatId))
		invalid(`unknown or duplicate module beat ${module.beatId}`);
	seen.add(module.beatId);
	for (const blockId of module.blockIds)
		if (!blockIds.has(blockId)) invalid(`module ${module.beatId} references unknown block ${blockId}`);
	const expectedEvidence = new Set(work.beats.find((beat) => beat.id === module.beatId)?.evidenceIds ?? []);
	for (const id of module.evidenceIds)
		if (!expectedEvidence.has(id)) invalid(`module ${module.beatId} references unknown evidence ${id}`);
}
for (const beatId of expectedBeats) if (!seen.has(beatId)) invalid(`chapter misses beat ${beatId}`);
finish("CHAPTER_VALID");
