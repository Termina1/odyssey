import { SectionBeatDraft, SectionBeatWorkItem } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

let work!: ReturnType<typeof SectionBeatWorkItem.parse>;
let draft!: ReturnType<typeof SectionBeatDraft.parse>;
try {
	work = parseJsonText(requiredEnv("WORK_JSON"), SectionBeatWorkItem, "WORK_JSON");
	draft = await parseJsonFile(requiredEnv("DRAFT_FILE"), SectionBeatDraft);
} catch (error) {
	reject(`Cannot read section beat inputs: ${errorMessage(error)}`);
}
if (draft.sectionId !== work.sectionId)
	reject(`section beat draft ${draft.sectionId} does not match ${work.sectionId}`);
const allowedEvidence = new Set(work.evidence.map((entry) => entry.id));
const errors: string[] = [];
if (work.currentBeats.length > 0) {
	const expectedIds = work.currentBeats.map((beat) => beat.id);
	const actualIds = draft.beats.map((beat) => beat.id);
	if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
		errors.push(
			`repair must preserve the ordered beat identity set; expected ${expectedIds.join(", ")}, got ${actualIds.join(", ")}`,
		);
	}
	const allowedBeatIds = new Set(work.allBeats.map((beat) => beat.id));
	for (const beat of draft.beats)
		for (const dependencyId of beat.dependsOnBeatIds)
			if (!allowedBeatIds.has(dependencyId))
				errors.push(`beat ${beat.id} depends on unknown beat ${dependencyId}; use an exact ID from allBeats`);
}
for (const beat of draft.beats) {
	for (const evidenceId of beat.evidenceIds)
		if (!allowedEvidence.has(evidenceId))
			errors.push(`beat ${beat.id} references evidence ${evidenceId} outside section packet`);
	if (!beat.narrativePurpose.trim()) errors.push(`beat ${beat.id} has no narrative purpose`);
	if (!beat.takeaway.trim()) errors.push(`beat ${beat.id} has no takeaway`);
}
if (errors.length > 0) reject(`Section beat draft is invalid: ${errors.join("; ")}`);
accept("SECTION_BEATS_VALID");
