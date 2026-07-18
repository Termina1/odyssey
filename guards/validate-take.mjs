import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const fail = (reason) => {
	process.stderr.write(`${reason}\n`);
	process.exit(1);
};

const stdin = await new Promise((resolveInput) => {
	let value = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => { value += chunk; });
	process.stdin.on("end", () => resolveInput(value));
});

let event;
try {
	event = JSON.parse(stdin);
} catch {
	fail("take guard: completion event is not valid JSON");
}

const manifest = event?.output;
if (!manifest || typeof manifest !== "object") fail("take guard: missing completion manifest");
if (typeof manifest.artifactPath !== "string" || !manifest.artifactPath) fail("take guard: missing artifactPath");
if (typeof manifest.takeId !== "string" || !manifest.takeId) fail("take guard: missing takeId");

const cwd = resolve(process.cwd());
const artifactPath = resolve(cwd, manifest.artifactPath);
if (artifactPath !== cwd && !artifactPath.startsWith(`${cwd}${sep}`)) fail("take guard: artifactPath escapes run directory");

let research;
try {
	research = JSON.parse(await readFile(artifactPath, "utf8"));
} catch (error) {
	fail(`take guard: cannot read artifact: ${error instanceof Error ? error.message : String(error)}`);
}

if (research.takeId !== manifest.takeId) fail(`take guard: takeId mismatch (${research.takeId} != ${manifest.takeId})`);
if (!Array.isArray(research.sources) || !Array.isArray(research.findings)) fail("take guard: sources/findings must be arrays");

const sourceIds = new Set();
for (const source of research.sources) {
	if (!source || typeof source.id !== "string" || !source.id) fail("take guard: source without id");
	if (sourceIds.has(source.id)) fail(`take guard: duplicate source id ${source.id}`);
	sourceIds.add(source.id);
	try {
		const url = new URL(source.url);
		if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol");
	} catch {
		fail(`take guard: invalid source URL for ${source.id}`);
	}
}

const findingIds = new Set();
for (const finding of research.findings) {
	if (!finding || typeof finding.id !== "string" || !finding.id) fail("take guard: finding without id");
	if (findingIds.has(finding.id)) fail(`take guard: duplicate finding id ${finding.id}`);
	findingIds.add(finding.id);
	if (typeof finding.claim !== "string" || !finding.claim.trim()) fail("take guard: empty finding claim");
	if (!Array.isArray(finding.sourceIds) || finding.sourceIds.length === 0) fail("take guard: finding without sourceIds");
	for (const sourceId of finding.sourceIds) {
		if (!sourceIds.has(sourceId)) fail(`take guard: finding references unknown source ${sourceId}`);
	}
}

if (!Array.isArray(research.acceptanceCriteria)) fail("take guard: acceptanceCriteria must be an array");
for (const criterion of research.acceptanceCriteria) {
	if (!criterion || typeof criterion.criterion !== "string" || !criterion.criterion.trim()) fail("take guard: empty acceptance criterion");
	if (typeof criterion.satisfied !== "boolean") fail("take guard: criterion.satisfied must be boolean");
	if (!Array.isArray(criterion.evidenceIds)) fail("take guard: criterion.evidenceIds must be an array");
	for (const evidenceId of criterion.evidenceIds) {
		if (!findingIds.has(evidenceId)) fail(`take guard: criterion references unknown evidence ${evidenceId}`);
	}
}

if (manifest.sourceCount !== research.sources.length) fail("take guard: sourceCount does not match artifact");
if (manifest.evidenceCount !== research.findings.length) fail("take guard: evidenceCount does not match artifact");
