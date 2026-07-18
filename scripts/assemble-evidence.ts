import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
	DeepResearch,
	type DeepResearch as DeepResearchType,
	EvidenceIndex,
	type EvidenceIndex as EvidenceIndexType,
} from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";

const files = parseJsonText(process.env.TAKE_FILES ?? "[]", z.array(z.string()), "TAKE_FILES");
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/research/evidence-index.json");
const hash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);
const normalizeUrl = (raw: string): string => {
	const url = new URL(raw);
	url.hash = "";
	for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
	return url.toString().replace(/\/$/, "");
};

const takes: DeepResearchType[] = [];
for (const file of files) takes.push(await parseJsonFile(file, DeepResearch));
const sourcesByUrl = new Map<string, DeepResearchType["sources"][number]>();
const evidenceById = new Map<string, EvidenceIndexType["evidence"][number]>();
const contradictions: EvidenceIndexType["contradictions"] = [];
const gaps: EvidenceIndexType["gaps"] = [];

for (const take of takes) {
	const localSources = new Map<string, string>();
	for (const source of take.sources) {
		const url = normalizeUrl(source.url);
		const id = `s_${hash(url)}`;
		localSources.set(source.id, id);
		if (!sourcesByUrl.has(url)) sourcesByUrl.set(url, { ...source, id, url });
	}
	for (const finding of take.findings) {
		const sourceIds = [
			...new Set(finding.sourceIds.map((id) => localSources.get(id)).filter((id): id is string => Boolean(id))),
		].sort();
		const claim = finding.claim.trim();
		const id = `e_${hash(`${claim.toLowerCase()}|${sourceIds.join(",")}`)}`;
		const existing = evidenceById.get(id);
		const next: EvidenceIndexType["evidence"][number] = {
			id,
			claim,
			sourceIds,
			confidence: finding.confidence,
			caveat: finding.caveat ?? "",
			tags: [...new Set(finding.tags)].sort(),
			takeIds: [take.takeId],
		};
		if (existing) {
			existing.takeIds = [...new Set([...existing.takeIds, take.takeId])].sort();
			existing.tags = [...new Set([...existing.tags, ...next.tags])].sort();
		} else evidenceById.set(id, next);
	}
	for (const description of take.contradictions) contradictions.push({ description, takeIds: [take.takeId] });
	for (const gap of take.gaps) gaps.push({ description: gap, takeIds: [take.takeId] });
}

const output = EvidenceIndex.parse({
	evidence: [...evidenceById.values()].sort((a, b) => a.id.localeCompare(b.id)),
	sources: [...sourcesByUrl.values()].sort((a, b) => a.id.localeCompare(b.id)),
	contradictions,
	gaps,
	counts: { takes: takes.length, evidence: evidenceById.size, sources: sourcesByUrl.size },
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
	JSON.stringify({
		type: "EVIDENCE_READY",
		output: { artifactPath: process.env.OUTPUT_PATH ?? "artifacts/research/evidence-index.json", ...output.counts },
	}),
);
