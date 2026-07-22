import { ChapterPlan, EvidenceIndex, SectionWorkItem } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";
import { accept, errorMessage, reject } from "./runtime.js";

let work!: ReturnType<typeof SectionWorkItem.parse>;
let plan!: ReturnType<typeof ChapterPlan.parse>;
let evidence!: ReturnType<typeof EvidenceIndex.parse>;
try {
	work = parseJsonText(requiredEnv("WORK_JSON"), SectionWorkItem, "WORK_JSON");
	[plan, evidence] = await Promise.all([
		parseJsonFile(requiredEnv("CHAPTER_PLAN_FILE"), ChapterPlan),
		parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex),
	]);
} catch (error) {
	reject(`Cannot read chapter plan inputs: ${errorMessage(error)}`);
}
if (plan.sectionId !== work.sectionId) reject("chapter plan sectionId mismatch");
const beats = work.beats;
const beatIds = new Set(beats.map((beat) => beat.id));
const intentIds = Object.keys(plan.elementIntents);
if (intentIds.length !== beatIds.size || intentIds.some((id) => !beatIds.has(id)))
	reject("elementIntents must contain exactly one intent for every verified beat");
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
const requestIds = new Set<string>();
let datasets = 0;
for (const beat of beats) {
	const intent = plan.elementIntents[beat.id];
	if (!intent || intent.beatId !== beat.id) reject(`intent for beat ${beat.id} is inconsistent`);
	const matching = Object.entries(plan.visualRequests).filter(([, request]) => request.beatId === beat.id);
	if (intent.guaranteedUse !== true)
		reject(
			`intent for beat ${beat.id} must set guaranteedUse: true (every intent, inline and dataset-backed alike, is a guaranteed-use commitment)`,
		);
	if (intent.mode === "inline") {
		if (matching.length > 0) reject(`inline beat ${beat.id} cannot have a visual request`);
		continue;
	}
	datasets += 1;
	if (matching.length !== 1) reject(`dataset-backed beat ${beat.id} must have exactly one required visual request`);
	const [id, request] = matching[0] ?? [];
	if (!id || request.id !== id || request.intent !== "dataset-backed" || request.required !== true)
		reject(`request ${id} does not match dataset intent ${beat.id}`);
	if (request.sectionId !== work.sectionId || request.beatId !== beat.id || request.evidenceIds.length === 0)
		reject(`request ${id} has inconsistent identity or no evidence boundary`);
	for (const evidenceId of request.evidenceIds)
		if (!evidenceIds.has(evidenceId) || !beat.evidenceIds.includes(evidenceId))
			reject(`request ${id} references evidence outside beat ${beat.id}`);
	if (requestIds.has(id)) reject(`duplicate visual request ${id}`);
	requestIds.add(id);
}
for (const id of Object.keys(plan.visualRequests))
	if (!requestIds.has(id)) reject(`visual request ${id} has no guaranteed dataset intent`);
if (datasets > work.experience.visualBudget)
	reject(`chapter visual budget exceeded: ${datasets} > ${work.experience.visualBudget}`);
accept("CHAPTER_PLAN_VALID");
