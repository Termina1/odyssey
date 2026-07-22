import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
	BeatDraft,
	EvidenceIndex,
	NarrativeStrategy,
	PlanGateFeedback,
	SectionBeatWorkItems,
} from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const strategy = await parseJsonFile(requiredEnv("STRATEGY_FILE"), NarrativeStrategy);
const evidence = await parseJsonFile(requiredEnv("EVIDENCE_FILE"), EvidenceIndex);
const feedback = parseJsonText(
	process.env.FEEDBACK_JSON ?? JSON.stringify({ reason: "", instructions: [] }),
	PlanGateFeedback,
	"FEEDBACK_JSON",
);
const MAX_VISITS = 3;
const attempt = Number.parseInt(process.env.ATTEMPT ?? "1", 10);
if (Number.isFinite(attempt) && attempt > MAX_VISITS) {
	process.stdout.write(
		`${JSON.stringify({
			type: "SECTION_REPAIR_EXHAUSTED",
			output: PlanGateFeedback.parse({
				reason: `Section beat repair budget exhausted after ${MAX_VISITS - 1} repair rounds. ${feedback.reason}`.trim(),
				instructions: feedback.instructions,
			}),
		})}\n`,
	);
	process.exit(0);
}
let current = BeatDraft.parse({ beats: [] });
const currentPath = process.env.CURRENT_BEATS_FILE;
const isRepair = feedback.reason.trim().length > 0 || feedback.instructions.length > 0;
if (currentPath && isRepair) {
	try {
		await access(resolve(process.cwd(), currentPath));
		current = await parseJsonFile(currentPath, BeatDraft);
	} catch {
		current = BeatDraft.parse({ beats: [] });
	}
}

const currentBySection = new Map(
	strategy.sections.map((section) => [section.id, current.beats.filter((beat) => beat.sectionId === section.id)]),
);
const feedbackText = [feedback.reason, ...feedback.instructions].join("\n").toLowerCase();
const sectionMatches = (sectionId: string): boolean => {
	const beats = currentBySection.get(sectionId) ?? [];
	const aliases = [
		sectionId.toLowerCase(),
		sectionId.split("-")[0]?.toLowerCase() ?? "",
		...beats.map((beat) => beat.id.toLowerCase()),
	];
	return aliases.some((alias) => alias.length > 0 && feedbackText.includes(alias));
};
const matchedSections = new Set(
	strategy.sections.filter((section) => sectionMatches(section.id)).map((section) => section.id),
);
const selectedSections =
	current.beats.length === 0
		? strategy.sections
		: matchedSections.size === 0
			? strategy.sections
			: strategy.sections.filter((section) => matchedSections.has(section.id));
const evidenceById = new Map(evidence.evidence.map((entry) => [entry.id, entry]));
const feedbackEvidenceIds = new Set(feedbackText.match(/e_[a-z0-9]+/g) ?? []);
const allSections = strategy.sections.map(({ id, title, purpose }) => ({ id, title, purpose }));
const allBeats = current.beats.map(({ id, sectionId, takeaway }) => ({ id, sectionId, takeaway }));
const items: Record<string, unknown> = {};
for (const section of selectedSections) {
	const currentBeats = currentBySection.get(section.id) ?? [];
	const allowedIds = new Set([
		...section.evidenceIds,
		...currentBeats.flatMap((beat) => beat.evidenceIds),
		...feedbackEvidenceIds,
	]);
	const relevantInstructions = feedback.instructions.filter((instruction) => {
		const value = instruction.toLowerCase();
		return [section.id, section.id.split("-")[0] ?? "", ...currentBeats.map((beat) => beat.id)].some(
			(alias) => alias.length > 0 && value.includes(alias.toLowerCase()),
		);
	});
	items[section.id] = {
		sectionId: section.id,
		section,
		currentBeats,
		evidence: [...allowedIds].flatMap((id) => {
			const entry = evidenceById.get(id);
			return entry === undefined ? [] : [entry];
		}),
		feedback: {
			reason: feedback.reason,
			instructions: relevantInstructions.length > 0 ? relevantInstructions : feedback.instructions,
		},
		mode: currentBeats.length === 0 ? "initial" : "repair",
		allSections,
		allBeats,
	};
}
const outputPath = requiredEnv("OUTPUT_PATH");
const output = SectionBeatWorkItems.parse({ items, count: Object.keys(items).length, artifactPath: outputPath });
const fullPath = resolve(process.cwd(), outputPath);
await mkdir(dirname(fullPath), { recursive: true });
await writeFile(fullPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ type: "SECTION_BEAT_WORK_READY", output })}\n`);
