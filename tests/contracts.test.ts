import assert from "node:assert/strict";
import test from "node:test";
import { DeepResearch } from "../contracts/index.js";

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
