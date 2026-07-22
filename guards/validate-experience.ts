import { BeatDraft, ExperiencePlan, NarrativeStrategy } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

// Validates the experience plan against the pre-verification beats candidate:
// section and beat identity are frozen before verification (verdicts only
// annotate beats), so layout planning runs in parallel with beat verification.
let strategy!: ReturnType<typeof NarrativeStrategy.parse>;
let candidate!: ReturnType<typeof BeatDraft.parse>;
let experience!: ReturnType<typeof ExperiencePlan.parse>;
try {
	[strategy, candidate, experience] = await Promise.all([
		parseJsonFile(requiredEnv("STRATEGY_FILE"), NarrativeStrategy),
		parseJsonFile(requiredEnv("CANDIDATE_FILE"), BeatDraft),
		parseJsonFile(requiredEnv("EXPERIENCE_FILE"), ExperiencePlan),
	]);
} catch (error) {
	reject(`Cannot read authoritative inputs: ${errorMessage(error)}`);
}
const sectionIds = new Set(strategy.sections.map((section) => section.id));
const beatIdsBySection = new Map<string, Set<string>>();
for (const beat of candidate.beats) {
	const set = beatIdsBySection.get(beat.sectionId) ?? new Set<string>();
	set.add(beat.id);
	beatIdsBySection.set(beat.sectionId, set);
}
for (const sectionId of sectionIds)
	if (!experience.sections[sectionId]) reject(`Missing experience section ${sectionId}`);
for (const [sectionId, section] of Object.entries(experience.sections)) {
	if (!sectionIds.has(sectionId) || section.sectionId !== sectionId)
		reject(`Unknown or mismatched experience section ${sectionId}`);
	const planBeatIds = beatIdsBySection.get(sectionId) ?? new Set<string>();
	for (const beatId of planBeatIds) if (!section.beats[beatId]) reject(`Section ${sectionId} misses beat ${beatId}`);
	for (const beatId of Object.keys(section.beats))
		if (!planBeatIds.has(beatId)) reject(`Section ${sectionId} references unknown beat ${beatId}`);
	const visuallyPlanned = Object.values(section.beats).filter((beat) => beat.visualIntent !== "none").length;
	if (visuallyPlanned > section.visualBudget) reject(`Section ${sectionId} exceeds visual budget`);
}
accept("EXPERIENCE_VALID");
