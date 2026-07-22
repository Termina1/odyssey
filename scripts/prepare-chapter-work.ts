import {
	EvidenceIndex,
	ExperiencePlan,
	ReportPlan,
	type SectionWorkItem,
	SectionWorkItems,
} from "../contracts/index.js";
import { emit, parseJsonFile, requiredEnv, writeJsonArtifact } from "../contracts/runtime.js";

const plan = await parseJsonFile(requiredEnv("PLAN_FILE"), ReportPlan);
const experience = await parseJsonFile(requiredEnv("EXPERIENCE_FILE"), ExperiencePlan);
const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
const beatsById = new Map(plan.beats.map((beat) => [beat.id, beat]));
const evidenceById = new Map(evidence.evidence.map((entry) => [entry.id, entry]));
const sourcesById = new Map(evidence.sources.map((entry) => [entry.id, entry]));
const items: Record<string, SectionWorkItem> = {};
for (let index = 0; index < plan.sections.length; index += 1) {
	const section = plan.sections[index];
	const experienceSection = experience.sections[section.id];
	if (!experienceSection) throw new Error(`Missing experience section ${section.id}`);
	const beats = section.beatIds
		.map((id) => beatsById.get(id))
		.filter((beat): beat is ReportPlan["beats"][number] => Boolean(beat));
	const sectionEvidence = [...new Set(beats.flatMap((beat) => beat.evidenceIds))].flatMap((id) => {
		const entry = evidenceById.get(id);
		return entry === undefined ? [] : [entry];
	});
	const sectionSources = [...new Set(sectionEvidence.flatMap((entry) => entry.sourceIds))].flatMap((id) => {
		const source = sourcesById.get(id);
		return source === undefined ? [] : [source];
	});
	items[section.id] = {
		sectionId: section.id,
		index,
		section,
		beats,
		evidence: sectionEvidence,
		sources: sectionSources,
		experience: experienceSection,
		maxBlocks: experience.globalRules.maxBlocksPerSection,
		chapterPlanPath: `artifacts/write/chapters/${section.id}/chapter-plan.json`,
		visualCatalogPath: `artifacts/write/chapters/${section.id}/visual-inputs.json`,
		elementPath: `artifacts/write/chapters/${section.id}/elements.json`,
		chapterPath: `artifacts/write/chapters/${section.id}/chapter.json`,
	};
}
const output = SectionWorkItems.parse({ items, count: Object.keys(items).length });
await writeJsonArtifact(requiredEnv("OUTPUT_PATH"), output);
emit("CHAPTER_WORK_READY", output);
