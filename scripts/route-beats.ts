import { BeatDraft, EvidenceIndex, NarrativeStrategy, PlanGateFeedbackOutput } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";
import { errorMessage } from "../guards/runtime.js";

const finish = (type: string, reason = ""): never => {
	process.stdout.write(
		`${JSON.stringify({ type, output: PlanGateFeedbackOutput.parse({ reason, instructions: reason ? [reason] : [] }) })}\n`,
	);
	process.exit(0);
};
try {
	const [draft, evidence, strategy] = await Promise.all([
		parseJsonFile(requiredEnv("DRAFT_FILE"), BeatDraft),
		parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex),
		parseJsonFile(requiredEnv("STRATEGY_FILE"), NarrativeStrategy),
	]);
	const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
	const sectionIds = new Set(strategy.sections.map((entry) => entry.id));
	const beatById = new Map(draft.beats.map((beat) => [beat.id, beat]));
	const structuralErrors: string[] = [];
	const evidenceErrors: string[] = [];
	for (const section of strategy.sections) {
		if (!draft.beats.some((beat) => beat.sectionId === section.id))
			structuralErrors.push(`section ${section.id} has no beats`);
	}
	for (const beat of draft.beats) {
		if (!sectionIds.has(beat.sectionId))
			structuralErrors.push(`beat ${beat.id} references unknown section ${beat.sectionId}`);
		for (const evidenceId of beat.evidenceIds)
			if (!evidenceIds.has(evidenceId))
				evidenceErrors.push(`beat ${beat.id} references unknown evidence ${evidenceId}`);
		for (const dependencyId of beat.dependsOnBeatIds)
			if (!beatById.has(dependencyId))
				structuralErrors.push(`beat ${beat.id} in section ${beat.sectionId} depends on unknown beat ${dependencyId}`);
	}
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const findCycle = (beatId: string, path: string[]): string[] | undefined => {
		if (visiting.has(beatId)) return [...path.slice(path.indexOf(beatId)), beatId];
		if (visited.has(beatId)) return undefined;
		visiting.add(beatId);
		for (const dependencyId of beatById.get(beatId)?.dependsOnBeatIds ?? []) {
			if (!beatById.has(dependencyId)) continue;
			const cycle = findCycle(dependencyId, [...path, beatId]);
			if (cycle) return cycle;
		}
		visiting.delete(beatId);
		visited.add(beatId);
		return undefined;
	};
	for (const beatId of beatById.keys()) {
		const cycle = findCycle(beatId, []);
		if (cycle) {
			structuralErrors.push(`beat dependency cycle: ${cycle.join(" -> ")}`);
			break;
		}
	}
	if (structuralErrors.length > 0) finish("BEATS_INVALID", structuralErrors.join("; "));
	if (evidenceErrors.length > 0) {
		const routeVisit = Number.parseInt(process.env.ROUTE_VISIT ?? "1", 10);
		if (Number.isFinite(routeVisit) && routeVisit >= 3)
			finish(
				"BEATS_INVALID",
				`Evidence micro-patch budget exhausted after ${routeVisit - 1} rounds; section repair required. ${evidenceErrors.join("; ")}`,
			);
		finish("BEAT_PATCH_REQUIRED", evidenceErrors.join("; "));
	}
	finish("BEATS_VALID");
} catch (error) {
	finish("BEATS_INVALID", `Cannot read authoritative beat inputs: ${errorMessage(error)}`);
}
