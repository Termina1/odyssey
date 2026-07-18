import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const files = JSON.parse(process.env.TAKE_FILES ?? "[]");
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/research/evidence-index.json");
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);
const normalizeUrl = (raw) => {
	const url = new URL(raw);
	url.hash = "";
	for (const key of [...url.searchParams.keys()]) {
		if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
	}
	return url.toString().replace(/\/$/, "");
};

const takes = [];
for (const file of files) takes.push(JSON.parse(await readFile(resolve(process.cwd(), file), "utf8")));

const sourcesByUrl = new Map();
const evidenceById = new Map();
const contradictions = [];
const gaps = [];

for (const take of takes) {
	const localSources = new Map();
	for (const source of take.sources ?? []) {
		const url = normalizeUrl(source.url);
		const id = `s_${hash(url)}`;
		localSources.set(source.id, id);
		if (!sourcesByUrl.has(url)) sourcesByUrl.set(url, { ...source, id, url });
	}
	for (const finding of take.findings ?? []) {
		const sourceIds = [...new Set((finding.sourceIds ?? []).map((id) => localSources.get(id)).filter(Boolean))].sort();
		const claim = String(finding.claim ?? "").trim();
		const id = `e_${hash(`${claim.toLowerCase()}|${sourceIds.join(",")}`)}`;
		const existing = evidenceById.get(id);
		const next = {
			id,
			claim,
			sourceIds,
			confidence: finding.confidence ?? "medium",
			caveat: finding.caveat ?? "",
			tags: [...new Set(finding.tags ?? [])].sort(),
			takeIds: [take.takeId],
		};
		if (existing) {
			existing.takeIds = [...new Set([...existing.takeIds, take.takeId])].sort();
			existing.tags = [...new Set([...existing.tags, ...next.tags])].sort();
		} else {
			evidenceById.set(id, next);
		}
	}
	for (const description of take.contradictions ?? []) contradictions.push({ description, takeIds: [take.takeId] });
	for (const gap of take.gaps ?? []) gaps.push({ description: gap, takeIds: [take.takeId] });
}

const output = {
	evidence: [...evidenceById.values()].sort((a, b) => a.id.localeCompare(b.id)),
	sources: [...sourcesByUrl.values()].sort((a, b) => a.id.localeCompare(b.id)),
	contradictions,
	gaps,
	counts: {
		takes: takes.length,
		evidence: evidenceById.size,
		sources: sourcesByUrl.size,
	},
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "EVIDENCE_READY", output: { artifactPath: process.env.OUTPUT_PATH ?? "artifacts/research/evidence-index.json", ...output.counts } }));
