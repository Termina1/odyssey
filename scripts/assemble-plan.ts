import { z } from "zod";
import {
	BeatItems,
	BeatVerdict,
	type BeatVerdict as BeatVerdictType,
	EvidenceIndex,
	NarrativeStrategy,
	ReportPlan,
} from "../contracts/index.js";
import { emit, parseJsonFile, parseJsonText, requiredEnv, writeJsonArtifact } from "../contracts/runtime.js";

const strategy = await parseJsonFile(requiredEnv("STRATEGY_FILE"), NarrativeStrategy);
const beatItems = await parseJsonFile(requiredEnv("BEAT_ITEMS_FILE"), BeatItems);
const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
const verifiedFiles = parseJsonText(process.env.VERIFIED_FILES ?? "[]", z.array(z.string()), "VERIFIED_FILES");
const verdicts: BeatVerdictType[] = [];
for (const file of verifiedFiles) verdicts.push(await parseJsonFile(file, BeatVerdict));

const expectedById = new Map(Object.values(beatItems.items).map((beat) => [beat.id, beat]));
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
const seenIds = new Set<string>();
for (const verdict of verdicts) {
	if (seenIds.has(verdict.id)) throw new Error(`duplicate verified beat id: ${verdict.id}`);
	seenIds.add(verdict.id);
	const expected = expectedById.get(verdict.id);
	if (!expected) throw new Error(`unexpected verified beat id: ${verdict.id}`);
	const allowedEvidence = new Set(expected.evidenceIds);
	for (const evidenceId of verdict.evidenceIds)
		if (!allowedEvidence.has(evidenceId) || !evidenceIds.has(evidenceId))
			throw new Error(`verified beat ${verdict.id} references unapproved evidence ${evidenceId}`);
	if (verdict.verdict !== "unsupported" && verdict.evidenceIds.length === 0)
		throw new Error(`accepted verified beat ${verdict.id} has no evidence`);
}
const missing = [...expectedById.keys()].filter((id) => !seenIds.has(id));
if (missing.length > 0) throw new Error(`missing verified beats: ${missing.join(", ")}`);
const accepted = verdicts
	.map((verdict) => {
		const expected = expectedById.get(verdict.id);
		if (!expected) throw new Error(`missing frozen beat ${verdict.id}`);
		return {
			id: expected.id,
			index: expected.index,
			sectionId: expected.sectionId,
			narrativePurpose: expected.narrativePurpose,
			takeaway: expected.takeaway,
			dependsOnBeatIds: expected.dependsOnBeatIds,
			verdict: verdict.verdict,
			evidenceIds: verdict.evidenceIds,
			confidence: verdict.confidence,
			caveat: verdict.caveat || expected.caveat || "",
			notes: verdict.notes,
		};
	})
	.sort((a, b) => a.index - b.index);
const unsupportedBeatIds = accepted.filter((beat) => beat.verdict === "unsupported").map((beat) => beat.id);
const output = ReportPlan.parse({
	title: strategy.title,
	objective: strategy.objective,
	thesis: strategy.thesis,
	readerQuestion: strategy.readerQuestion,
	sections: strategy.sections.map((section) => ({
		...section,
		beatIds: accepted.filter((beat) => beat.sectionId === section.id).map((beat) => beat.id),
	})),
	beats: accepted,
	exclusions: strategy.exclusions,
	styleNotes: strategy.styleNotes,
	blockers: evidence.blockers,
	contradictions: evidence.contradictions,
	unsupportedBeatIds,
	beatDependencies: Object.fromEntries([...expectedById.values()].map((beat) => [beat.id, beat.dependsOnBeatIds])),
});
const outputPath = process.env.OUTPUT_PATH ?? "artifacts/plan/report-plan.json";
await writeJsonArtifact(outputPath, output);
emit("PLAN_ASSEMBLED", {
	artifactPath: outputPath,
	sectionCount: output.sections.length,
	beatCount: output.beats.length,
});
