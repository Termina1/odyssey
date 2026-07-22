import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { type EvidenceDepth, RESEARCH_CAPS } from "../contracts/constants.js";
import { DeepResearch } from "../contracts/index.js";
import { requiredEnv } from "../contracts/runtime.js";
import { errorMessage, reject } from "./runtime.js";

const stdin = await new Promise<string>((resolveInput) => {
	let value = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => (value += chunk));
	process.stdin.on("end", () => resolveInput(value));
});
let event!: { output?: { artifactPath?: string; takeId?: string; sourceCount?: number; evidenceCount?: number } };
try {
	event = JSON.parse(stdin) as typeof event;
} catch {
	reject("take guard: completion event is not valid JSON");
}
const manifest = event.output ?? reject("take guard: missing completion manifest");
if (typeof manifest.artifactPath !== "string" || typeof manifest.takeId !== "string")
	reject("take guard: missing completion manifest");
const artifactPathValue = manifest.artifactPath as string;
const takeIdValue = manifest.takeId as string;
const expectedTakeId = requiredEnv("EXPECTED_TAKE_ID");
const declaredArtifactValue = requiredEnv("ARTIFACT_FILE");
const cwd = resolve(process.cwd());
const manifestArtifactPath = resolve(cwd, artifactPathValue);
const artifactPath = resolve(cwd, declaredArtifactValue);
if (artifactPath !== cwd && !artifactPath.startsWith(`${cwd}${sep}`))
	reject("take guard: artifactPath escapes run directory");
if (manifestArtifactPath !== artifactPath)
	reject("take guard: completion manifest does not name the declared artifact");
if (takeIdValue !== expectedTakeId) reject(`take guard: expected take ${expectedTakeId}, received ${takeIdValue}`);
let research!: ReturnType<typeof DeepResearch.parse>;
try {
	research = DeepResearch.parse(JSON.parse(await readFile(artifactPath, "utf8")));
} catch (error) {
	reject(`take guard: cannot read artifact: ${errorMessage(error)}`);
}
if (research.takeId !== expectedTakeId) reject(`take guard: takeId mismatch (${research.takeId} != ${expectedTakeId})`);
if (manifest.sourceCount !== research.sources.length) reject("take guard: sourceCount does not match artifact");
if (manifest.evidenceCount !== research.findings.length) reject("take guard: evidenceCount does not match artifact");
const sourceIds = new Set<string>();
for (const source of research.sources) {
	if (sourceIds.has(source.id)) reject(`take guard: duplicate source id ${source.id}`);
	sourceIds.add(source.id);
	try {
		if (!/^https?:$/.test(new URL(source.url).protocol)) throw new Error("unsupported protocol");
	} catch {
		reject(`take guard: invalid source URL for ${source.id}`);
	}
}
const findingIds = new Set<string>();
for (const finding of research.findings) {
	if (findingIds.has(finding.id)) reject(`take guard: duplicate finding id ${finding.id}`);
	findingIds.add(finding.id);
	for (const sourceId of finding.sourceIds)
		if (!sourceIds.has(sourceId)) reject(`take guard: finding references unknown source ${sourceId}`);
}
for (const criterion of research.acceptanceCriteria)
	for (const evidenceId of criterion.evidenceIds)
		if (!findingIds.has(evidenceId)) reject(`take guard: criterion references unknown evidence ${evidenceId}`);
const depth = process.env.EVIDENCE_DEPTH as EvidenceDepth;
if (!(depth in RESEARCH_CAPS))
	reject(`take guard: evidenceDepth must be skim|standard|deep (received ${depth ?? "missing"})`);
const limits = RESEARCH_CAPS[depth];
if (research.sources.length > limits.maxSourcesPerTake)
	reject(`take guard: source cap ${limits.maxSourcesPerTake} exceeded`);
if (research.findings.length > limits.maxEvidencePerTake)
	reject(`take guard: evidence cap ${limits.maxEvidencePerTake} exceeded`);
