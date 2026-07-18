import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const readJson = (path) => readFile(resolve(process.cwd(), path), "utf8").then(JSON.parse);
const strategy = await readJson(process.env.STRATEGY_FILE);
const beatItems = await readJson(process.env.BEAT_ITEMS_FILE);
const evidence = await readJson(process.env.EVIDENCE_FILE);
const verifiedFiles = JSON.parse(process.env.VERIFIED_FILES ?? "[]");
const verified = [];
for (const file of verifiedFiles) verified.push(await readJson(file));

const expectedById = new Map(Object.values(beatItems.items ?? {}).map((beat) => [beat.id, beat]));
const evidenceIds = new Set((evidence.evidence ?? []).map((entry) => entry.id));
const seenIds = new Set();
for (const beat of verified) {
	if (seenIds.has(beat.id)) throw new Error(`duplicate verified beat id: ${beat.id}`);
	seenIds.add(beat.id);
	const expected = expectedById.get(beat.id);
	if (!expected) throw new Error(`unexpected verified beat id: ${beat.id}`);
	for (const field of ["index", "sectionId", "narrativePurpose"]) {
		if (beat[field] !== expected[field]) throw new Error(`verified beat ${beat.id} changed ${field}`);
	}
	const allowedEvidence = new Set(expected.evidenceIds ?? []);
	for (const evidenceId of beat.evidenceIds ?? []) {
		if (!allowedEvidence.has(evidenceId) || !evidenceIds.has(evidenceId)) {
			throw new Error(`verified beat ${beat.id} references unapproved evidence ${evidenceId}`);
		}
	}
	if (beat.verdict !== "unsupported" && (beat.evidenceIds ?? []).length === 0) {
		throw new Error(`accepted verified beat ${beat.id} has no evidence`);
	}
}

const missing = [...expectedById.keys()].filter((id) => !seenIds.has(id));
if (missing.length > 0) throw new Error(`missing verified beats: ${missing.join(", ")}`);

const accepted = verified
	.filter((beat) => beat.verdict !== "unsupported")
	.sort((a, b) => a.index - b.index);
const sections = (strategy.sections ?? []).map((section) => ({
	...section,
	beatIds: accepted.filter((beat) => beat.sectionId === section.id).map((beat) => beat.id),
}));

const output = {
	title: strategy.title,
	objective: strategy.objective,
	thesis: strategy.thesis,
	readerQuestion: strategy.readerQuestion,
	sections,
	beats: accepted,
	exclusions: strategy.exclusions ?? [],
	styleNotes: strategy.styleNotes ?? [],
};

const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/plan/report-plan.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "PLAN_ASSEMBLED", output: { artifactPath: process.env.OUTPUT_PATH ?? "artifacts/plan/report-plan.json", sectionCount: sections.length, beatCount: accepted.length } }));
