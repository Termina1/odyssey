import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = await mkdtemp(resolve(tmpdir(), "report-engine-write-"));
const artifacts = resolve(work, "artifacts");
await mkdir(resolve(artifacts, "images"), { recursive: true });
const writeJson = async (path, value) => { const full = resolve(work, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, `${JSON.stringify(value, null, 2)}\n`); };
const run = (script, env) => execFileSync("node", [resolve(root, script)], { cwd: work, env: { ...process.env, ...env }, encoding: "utf8" }).trim();

const evidence = {
  evidence: [{ id: "e_1", claim: "Adoption rose from 20 to 45", sourceIds: ["s_1"], confidence: "high", caveat: "Illustrative fixture", tags: ["adoption"], takeIds: ["take"] }],
  sources: [{ id: "s_1", title: "Primary dataset", url: "https://example.com/data", publisher: "Example", sourceType: "official" }],
  contradictions: [], gaps: [], counts: { takes: 1, evidence: 1, sources: 1 },
};
const beat = { id: "b1", index: 0, sectionId: "s1", narrativePurpose: "Show change", verdict: "supported", takeaway: "Adoption increased", evidenceIds: ["e_1"], confidence: 0.9, caveat: "", notes: [] };
const plan = { title: "Fixture report", objective: "Explain adoption", thesis: "Adoption increased", readerQuestion: "How fast?", sections: [{ id: "s1", title: "The shift", purpose: "Explain the trend", evidenceIds: ["e_1"], beatIds: ["b1"] }], beats: [beat], exclusions: [], styleNotes: [] };
const request = { id: "v1", sectionId: "s1", beatId: "b1", kind: "dataset", purpose: "Show the trend", question: "How did adoption change?", evidenceIds: ["e_1"], preferredOutput: "line", requirements: ["two dated points"], fallback: "table" };
const experience = { direction: "Editorial analytical", density: "balanced", globalRules: { maxBlocksPerBeat: 1, maxBlocksPerSection: 3, avoidRepeatedTypes: true, progressiveEvidenceDisclosure: true }, sections: { s1: { sectionId: "s1", layout: "split", openingMode: "claim", openingClaim: "The curve changed", handoff: "What follows", visualBudget: 1, beats: { b1: { beatId: "b1", presentation: "anchor", visualIntent: "data", preferredOutputs: ["line"] } } } } };
const chapterPlan = { sectionId: "s1", layout: "split", openingClaim: "The curve changed", handoff: "What follows", visualRequests: { v1: request } };
const visual = { requestId: "v1", kind: "dataset", status: "usable", sourceIds: ["s_1"], sourceUrls: ["https://example.com/data"], dataset: { id: "d1", title: "Adoption", description: "Share over time", fields: [{ key: "year", label: "Year", type: "date" }, { key: "value", label: "Adoption", type: "number", unit: "%" }], rows: [{ year: "2024", value: 20 }, { year: "2025", value: 45 }], provenance: [{ sourceUrl: "https://example.com/data", evidenceId: "e_1", extractionNote: "fixture" }], limitations: [] }, limitations: [] };
await writeJson("artifacts/evidence.json", evidence); await writeJson("artifacts/plan.json", plan); await writeJson("artifacts/experience.json", experience); await writeJson("artifacts/visual.json", visual);

if (!run("scripts/validate-experience.mjs", { PLAN_FILE: "artifacts/plan.json", EVIDENCE_FILE: "artifacts/evidence.json", EXPERIENCE_FILE: "artifacts/experience.json" }).includes("EXPERIENCE_VALID")) throw new Error("experience validation failed");
if (!run("scripts/validate-visual-input.mjs", { REQUEST_JSON: JSON.stringify(request), INPUT_FILE: "artifacts/visual.json", EVIDENCE_FILE: "artifacts/evidence.json" }).includes("VISUAL_INPUT_VALID")) throw new Error("visual validation failed");
const badRequest = { ...request, id: "wrong" };
if (!run("scripts/validate-visual-input.mjs", { REQUEST_JSON: JSON.stringify(badRequest), INPUT_FILE: "artifacts/visual.json", EVIDENCE_FILE: "artifacts/evidence.json" }).includes("VISUAL_INPUT_INVALID")) throw new Error("invalid visual id was accepted");
run("scripts/prepare-chapter-work.mjs", { PLAN_FILE: "artifacts/plan.json", EXPERIENCE_FILE: "artifacts/experience.json", OUTPUT_PATH: "artifacts/work.json" });
const workItems = JSON.parse(await readFile(resolve(work, "artifacts/work.json"), "utf8")); const item = workItems.items.s1;
if (!run("scripts/route-chapter-start.mjs", { WORK_JSON: JSON.stringify(item) }).includes("START_LAYOUT")) throw new Error("initial chapter route failed");
await writeJson(item.chapterPlanPath, chapterPlan);
run("scripts/assemble-chapter-visual-inputs.mjs", { SECTION_ID: "s1", VISUAL_FILES: JSON.stringify(["artifacts/visual.json"]), OUTPUT_PATH: item.visualCatalogPath });
const elements = { sectionId: "s1", blocks: [{ id: "chart1", beatId: "b1", type: "chart", title: "Adoption accelerated", purpose: "Show the trend", evidenceIds: ["e_1"], datasetRequestId: "v1", variant: "line", encoding: { x: "year", y: "value" }, annotations: [], interaction: { tooltip: true, zoom: false, legendFilter: false } }] };
const section = { sectionId: "s1", title: "The shift", dek: "A concise explanation", openingClaim: "The curve changed", modules: [{ beatId: "b1", headline: "Adoption accelerated", body: "The available evidence shows a clear increase between the two observed periods.", presentation: "anchor", layout: "split", blockIds: ["chart1"], evidenceIds: ["e_1"], caveat: "Illustrative fixture" }], handoff: "Next" };
await writeJson(item.elementPath, elements); await writeJson(item.chapterPath, section);
if (!run("scripts/validate-elements.mjs", { WORK_JSON: JSON.stringify(item), ELEMENTS_FILE: item.elementPath, VISUAL_CATALOG_FILE: item.visualCatalogPath }).includes("ELEMENTS_VALID")) throw new Error("element validation failed");
const metricVisual = { ...visual, requestId: "metrics", dataset: { ...visual.dataset, fields: [{ key: "name", label: "Name", type: "category" }, { key: "value", label: "Value", type: "category" }], rows: [{ name: "before", value: "4 days" }, { name: "after", value: "10 minutes" }] } };
const metricElements = { sectionId: "s1", blocks: [{ id: "metrics1", beatId: "b1", type: "metric-strip", title: "Before and after", purpose: "Show operational change", evidenceIds: ["e_1"], datasetRequestId: "metrics", metrics: [{ label: "Before", valueField: "value", where: { name: "before" } }, { label: "After", valueField: "value", where: { name: "after" } }] }] };
await writeJson("artifacts/metric-visual.json", metricVisual);
await writeJson("artifacts/metric-catalog.json", { sectionId: "s1", inputs: [metricVisual] });
await writeJson("artifacts/metric-elements.json", metricElements);
if (!run("scripts/validate-elements.mjs", { WORK_JSON: JSON.stringify(item), ELEMENTS_FILE: "artifacts/metric-elements.json", VISUAL_CATALOG_FILE: "artifacts/metric-catalog.json" }).includes("ELEMENTS_VALID")) throw new Error("metric selector validation failed");
metricElements.blocks[0].metrics[0].valueField = "missing";
await writeJson("artifacts/metric-elements-invalid.json", metricElements);
if (!run("scripts/validate-elements.mjs", { WORK_JSON: JSON.stringify(item), ELEMENTS_FILE: "artifacts/metric-elements-invalid.json", VISUAL_CATALOG_FILE: "artifacts/metric-catalog.json" }).includes("ELEMENTS_INVALID")) throw new Error("invalid metric selector was accepted");
if (!run("scripts/validate-chapter.mjs", { WORK_JSON: JSON.stringify(item), ELEMENTS_FILE: item.elementPath, CHAPTER_FILE: item.chapterPath }).includes("CHAPTER_VALID")) throw new Error("chapter validation failed");
const rewrite = { reason: "Tighten the opening", chapters: { s1: { owner: "copy", instructions: ["Rewrite the opening"] } } };
run("scripts/route-chapter-rework.mjs", { WORK_FILE: "artifacts/work.json", FEEDBACK_JSON: JSON.stringify(rewrite), OUTPUT_PATH: "artifacts/rework.json" });
const rework = JSON.parse(await readFile(resolve(work, "artifacts/rework.json"), "utf8")).items.s1;
if (!run("scripts/route-chapter-start.mjs", { WORK_JSON: JSON.stringify(rework) }).includes("START_COPY")) throw new Error("targeted copy rework route failed");
const layoutRework = { ...item, reworkFeedback: { owner: "layout", reason: "Visual mismatch", instructions: ["Replan visuals"] } };
if (!run("scripts/route-chapter-start.mjs", { WORK_JSON: JSON.stringify(layoutRework) }).includes("START_LAYOUT")) throw new Error("targeted layout rework route failed");
run("scripts/assemble-report-document.mjs", { PLAN_FILE: "artifacts/plan.json", EVIDENCE_FILE: "artifacts/evidence.json", EXPERIENCE_FILE: "artifacts/experience.json", WORK_FILE: "artifacts/work.json", VISUAL_FILES: JSON.stringify(["artifacts/visual.json"]), OUTPUT_PATH: "artifacts/report-document.json" });
run("engine/render-report.mjs", { DOCUMENT_FILE: "artifacts/report-document.json", OUTPUT_PATH: "artifacts/report.html" });
if (!run("scripts/validate-render.mjs", { DOCUMENT_FILE: "artifacts/report-document.json", HTML_FILE: "artifacts/report.html", OUTPUT_PATH: "artifacts/render-review.json" }).includes("RENDER_VALIDATED")) throw new Error("render validation failed");
const screenshots = JSON.parse(run("scripts/screenshot-report.mjs", { HTML_FILE: "artifacts/report.html", OUTPUT_DIR: "artifacts/screenshots", OUTPUT_PATH: "artifacts/screenshots.json" })).output;
if (!Array.isArray(screenshots.tiles) || !screenshots.tiles.some((tile) => tile.viewport === "desktop") || !screenshots.tiles.some((tile) => tile.viewport === "mobile")) throw new Error("screenshot tile manifest incomplete");
const qaFeedback = { reason: "Mobile chart density", chapters: { s1: { owner: "layout", instructions: ["Reduce chart density"] } }, engineIssues: [] };
if (!run("scripts/visual-rewrite-budget.mjs", { QA_VISIT: "1", FEEDBACK_JSON: JSON.stringify(qaFeedback) }).includes("ALLOW_REWRITE")) throw new Error("first visual rewrite was not allowed");
if (!run("scripts/visual-rewrite-budget.mjs", { QA_VISIT: "2", FEEDBACK_JSON: JSON.stringify(qaFeedback) }).includes("QA_LIMIT_REACHED")) throw new Error("visual rewrite limit failed");
run("scripts/finalize-visual-warnings.mjs", { FEEDBACK_JSON: JSON.stringify(qaFeedback), OUTPUT_PATH: "artifacts/visual-warnings.json" });
const html = await readFile(resolve(work, "artifacts/report.html"), "utf8");
if (!html.includes("chart-chart1") || !html.includes("echarts")) throw new Error("chart runtime missing from rendered HTML");
console.log(JSON.stringify({ pass: true, work, bytes: Buffer.byteLength(html), chart: "chart1", invalidCase: "requestId rejected" }));
