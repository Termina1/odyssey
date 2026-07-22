import assert from "node:assert/strict";
import test from "node:test";
import {
	BeatDraft,
	DeepResearch,
	ElementPackage,
	NarrativeStrategy,
	VerifiedBeat,
	VisualInput,
} from "../contracts/index.js";

const validResearch = () => ({
	takeId: "take-1",
	answer: "Supported answer",
	findings: [{ id: "e_1", claim: "Supported claim", sourceIds: ["s_1"], confidence: "high" as const, tags: [] }],
	sources: [
		{
			id: "s_1",
			title: "Official source",
			url: "https://example.test/source",
			publisher: "Example",
			sourceType: "official",
		},
	],
	contradictions: [],
	gaps: [],
	acceptanceCriteria: [{ criterion: "A supported criterion", satisfied: true, evidenceIds: ["e_1"] }],
});

const messages = (value: unknown): string => {
	const result = DeepResearch.safeParse(value);
	assert.equal(result.success, false, "fixture should be rejected");
	return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
};

test("DeepResearch accepts a referentially valid artifact", () => {
	assert.equal(DeepResearch.safeParse(validResearch()).success, true);
});

test("DeepResearch owns source URL and uniqueness validation", () => {
	const invalid = validResearch();
	const [source] = invalid.sources;
	assert.ok(source);
	source.url = "file:///tmp/source";
	invalid.sources.push({ ...source });
	const error = messages(invalid);
	assert.match(error, /sources\.0\.url/);
	assert.match(error, /Duplicate source id s_1/);
});

test("DeepResearch owns finding content and source referential integrity", () => {
	const invalid = validResearch();
	const [finding] = invalid.findings;
	assert.ok(finding);
	finding.claim = "   ";
	finding.sourceIds = ["s_missing"];
	invalid.findings.push({ ...finding });
	const error = messages(invalid);
	assert.match(error, /Must not be blank/);
	assert.match(error, /Unknown source id s_missing/);
	assert.match(error, /Duplicate finding id e_1/);
});

test("DeepResearch owns acceptance-criterion referential integrity", () => {
	const invalid = validResearch();
	const [criterion] = invalid.acceptanceCriteria;
	assert.ok(criterion);
	criterion.criterion = "";
	criterion.evidenceIds = ["e_missing"];
	const error = messages(invalid);
	assert.match(error, /Must not be blank/);
	assert.match(error, /Unknown evidence id e_missing/);
});

const rejectedMessages = (
	schema: {
		safeParse(value: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
	},
	value: unknown,
): string => {
	const result = schema.safeParse(value);
	assert.equal(result.success, false, "fixture should be rejected");
	return result.error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") ?? "";
};

test("NarrativeStrategy contract owns narrative and section allocation invariants", () => {
	const invalid = {
		title: "Title",
		objective: "Objective",
		thesis: "   ",
		readerQuestion: "",
		sections: [
			{ id: "same", title: "One", purpose: "One", evidenceIds: [] },
			{ id: "same", title: "Two", purpose: "Two", evidenceIds: ["e_1"] },
		],
		exclusions: [],
		styleNotes: [],
	};
	const error = rejectedMessages(NarrativeStrategy, invalid);
	assert.match(error, /Must not be blank/);
	assert.match(error, /must allocate evidence/);
	assert.match(error, /Duplicate strategy section id same/);
	assert.equal(
		NarrativeStrategy.safeParse({ ...invalid, thesis: "Thesis", readerQuestion: "Question", sections: [] }).success,
		false,
	);
});

test("BeatDraft contract owns unique IDs, takeaway content, and evidence presence", () => {
	const beat = {
		id: "beat-1",
		sectionId: "section-1",
		narrativePurpose: "Purpose",
		takeaway: "   ",
		evidenceIds: [] as string[],
	};
	const error = rejectedMessages(BeatDraft, { beats: [beat, { ...beat, takeaway: "Takeaway", evidenceIds: ["e_1"] }] });
	assert.match(error, /Beat takeaway must not be blank/);
	assert.match(error, /Beat must reference evidence/);
	assert.match(error, /Duplicate beat id beat-1/);
});

test("VerifiedBeat contract requires evidence for accepted verdicts", () => {
	const beat = {
		id: "beat-1",
		index: 0,
		sectionId: "section-1",
		narrativePurpose: "Purpose",
		verdict: "supported" as const,
		takeaway: "Takeaway",
		evidenceIds: [],
		confidence: 0.8,
		caveat: "",
		notes: [],
	};
	assert.match(rejectedMessages(VerifiedBeat, beat), /must reference evidence/);
	assert.equal(VerifiedBeat.safeParse({ ...beat, verdict: "unsupported" }).success, true);
});

const validDataset = () => ({
	id: "dataset-1",
	title: "Dataset",
	description: "Description",
	fields: [{ key: "year", label: "Year", type: "number" as const }],
	rows: [{ year: 2025 }],
	provenance: [],
	limitations: [],
});

test("VisualInput contract owns IDs, URLs, usable payloads, rows, and fallbacks", () => {
	const base = {
		requestId: "request-1",
		kind: "dataset" as const,
		status: "usable" as const,
		sourceIds: ["e_1"],
		sourceUrls: ["file:///tmp/source"],
		dataset: { ...validDataset(), rows: [{ unknown: 1 }] },
		limitations: [],
	};
	const error = rejectedMessages(VisualInput, base);
	assert.match(error, /s_ source-record prefix/);
	assert.match(error, /URL must use http or https/);
	assert.match(error, /undeclared field unknown/);
	assert.match(
		rejectedMessages(VisualInput, {
			...base,
			sourceIds: ["s_1"],
			sourceUrls: ["https://example.test"],
			dataset: undefined,
		}),
		/requires plot-ready rows/,
	);
	assert.match(
		rejectedMessages(VisualInput, {
			...base,
			sourceIds: ["s_1"],
			sourceUrls: [],
			dataset: validDataset(),
		}),
		/requires provenance URLs/,
	);
	assert.match(
		rejectedMessages(VisualInput, {
			...base,
			kind: "image",
			sourceIds: ["s_1"],
			sourceUrls: ["https://example.test"],
			dataset: undefined,
		}),
		/requires a localPath/,
	);
	assert.match(
		rejectedMessages(VisualInput, { ...base, status: "not-found", sourceIds: [], sourceUrls: [], dataset: undefined }),
		/requires a fallback/,
	);
});

test("ElementPackage contract owns block IDs and chart encoding structure", () => {
	const chart = {
		id: "chart-1",
		beatId: "beat-1",
		title: "Chart",
		purpose: "Purpose",
		evidenceIds: ["e_1"],
		type: "chart" as const,
		datasetRequestId: "request-1",
		variant: "heatmap" as const,
		encoding: { x: "x", unsupported: "bad" },
		annotations: [],
		interaction: { tooltip: true, zoom: false, legendFilter: false },
	};
	const error = rejectedMessages(ElementPackage, { sectionId: "section-1", blocks: [chart, { ...chart }] });
	assert.match(error, /Duplicate block id chart-1/);
	assert.match(error, /Unsupported chart encoding channel unsupported/);
	assert.match(error, /requires encoding\.y/);
	assert.match(error, /requires encoding\.value/);
	assert.match(
		rejectedMessages(ElementPackage, {
			sectionId: "section-1",
			blocks: [{ ...chart, id: "   ", variant: "line", encoding: { x: "x", y: "y" } }],
		}),
		/Block id must not be blank/,
	);
	assert.match(
		rejectedMessages(ElementPackage, {
			sectionId: "section-1",
			blocks: [{ ...chart, variant: "treemap", encoding: { value: "value" } }],
		}),
		/requires encoding.name or encoding.x/,
	);
});
