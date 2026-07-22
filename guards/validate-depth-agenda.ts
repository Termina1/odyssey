import { type EvidenceDepth, RESEARCH_CAPS } from "../contracts/constants.js";
import { DeepResearchAgenda, NarrativeSkeleton } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

const depth = requiredEnv("EVIDENCE_DEPTH") as EvidenceDepth;
if (!(depth in RESEARCH_CAPS)) reject(`evidenceDepth must be skim|standard|deep (received ${depth})`);
try {
	const [agenda, skeleton] = await Promise.all([
		parseJsonFile(requiredEnv("AGENDA_FILE"), DeepResearchAgenda),
		process.env.SKELETON_FILE
			? parseJsonFile(process.env.SKELETON_FILE, NarrativeSkeleton)
			: Promise.resolve({ coverageTags: [], beats: [] }),
	]);
	const limits = RESEARCH_CAPS[depth];
	const takes = Object.values(agenda.takes);
	const errors: string[] = [];
	if (takes.length > limits.deepTakeCap)
		errors.push(`agenda has ${takes.length} takes; ${depth} cap is ${limits.deepTakeCap}`);
	const skeletonTags = new Set([...skeleton.coverageTags, ...skeleton.beats.flatMap((beat) => beat.coverageTags)]);
	for (const take of takes) {
		if (skeletonTags.size > 0 && !take.coverageTags.some((tag) => skeletonTags.has(tag)))
			errors.push(`take ${take.id} does not cover a skeleton tag`);
		if (take.depthBudget > limits.maxEvidencePerTake)
			errors.push(`take ${take.id} exceeds depth budget ${limits.maxEvidencePerTake}`);
		if (take.stopRule.trim().length < 20) errors.push(`take ${take.id} has no substantive stop rule`);
	}
	if (agenda.stopRule.trim().length < 40) errors.push("agenda has no substantive global stop rule");
	if (errors.length > 0) reject(`Depth agenda is invalid: ${errors.join("; ")}`);
	accept("DEPTH_AGENDA_VALID");
} catch (error) {
	reject(`Cannot read depth agenda: ${errorMessage(error)}`);
}
