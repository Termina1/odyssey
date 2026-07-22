import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
	BeatDraft,
	BeatDraftOutput,
	NarrativeStrategy,
	PlanGateFeedbackOutput,
	SectionBeatDraft,
} from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const files = parseJsonText(process.env.SECTION_FILES ?? "[]", z.array(z.string()), "SECTION_FILES");
const strategy = await parseJsonFile(requiredEnv("STRATEGY_FILE"), NarrativeStrategy);
let current = BeatDraft.parse({ beats: [] });
const currentPath = process.env.CURRENT_BEATS_FILE;
if (currentPath) {
	try {
		await access(resolve(process.cwd(), currentPath));
		current = await parseJsonFile(currentPath, BeatDraft);
	} catch {
		current = BeatDraft.parse({ beats: [] });
	}
}
const replacements = new Map<string, ReturnType<typeof SectionBeatDraft.parse>>();
for (const file of files) {
	const section = await parseJsonFile(file, SectionBeatDraft);
	if (replacements.has(section.sectionId)) throw new Error(`Duplicate generated section ${section.sectionId}`);
	replacements.set(section.sectionId, section);
}
const strategyIds = new Set(strategy.sections.map((section) => section.id));
for (const sectionId of replacements.keys())
	if (!strategyIds.has(sectionId)) throw new Error(`Unknown generated section ${sectionId}`);
const beats = strategy.sections.flatMap((section) => {
	const replacement = replacements.get(section.id);
	if (replacement !== undefined) return replacement.beats;
	return current.beats.filter((beat) => beat.sectionId === section.id);
});
for (const section of strategy.sections)
	if (!beats.some((beat) => beat.sectionId === section.id))
		throw new Error(`Section ${section.id} has no beats after assembly`);
const draft = BeatDraftOutput.parse({ beats });
const outputPath = requiredEnv("OUTPUT_PATH");
const fullPath = resolve(process.cwd(), outputPath);
await mkdir(dirname(fullPath), { recursive: true });
await writeFile(fullPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
if (process.env.SNAPSHOT_PATH) {
	const snapshotPath = resolve(process.cwd(), process.env.SNAPSHOT_PATH);
	await mkdir(dirname(snapshotPath), { recursive: true });
	await writeFile(snapshotPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}
process.stdout.write(
	`${JSON.stringify({ type: "SECTION_BEATS_ASSEMBLED", output: PlanGateFeedbackOutput.parse({ reason: "", instructions: [] }) })}\n`,
);
