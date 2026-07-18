import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { buildChartModel, validateChartContract, type ChartDataset } from "../engine/render-model.js";
import { CHART_VARIANTS, chartFixture, datasetForVariant, makeFixtureDocument } from "./renderer-fixtures.js";

const execFileAsync = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);

for (const variant of CHART_VARIANTS) {
  test(`builds deterministic semantics for ${variant}`, () => {
    const block = chartFixture(variant, 0);
    const model = buildChartModel(block, datasetForVariant(variant));
    assert.equal(model.options.animation, false);
    assert.ok(model.options.series?.length, `${variant} should have series`);
    assert.ok(model.tableRows?.length, `${variant} should expose accessible rows`);
    assert.equal(JSON.stringify(model.options).includes("undefined"), false);
  });
}

test("workflow element validation accepts every renderer chart variant", async () => {
  const workDir = await mkdtemp(resolve(tmpdir(), "odyssey-element-variants-"));
  const workItem = {
    sectionId: "s1", index: 0,
    section: { id: "s1", title: "Section", purpose: "Test", evidenceIds: ["e_1"], beatIds: ["beat-1"] },
    beats: [{ id: "beat-1", index: 0, sectionId: "s1", narrativePurpose: "Test", verdict: "supported", takeaway: "Takeaway", evidenceIds: ["e_1"], confidence: 1, caveat: "", notes: [] }],
    experience: { sectionId: "s1", layout: "split", openingMode: "claim", openingClaim: "Claim", handoff: "Next", visualBudget: 1, beats: { "beat-1": { beatId: "beat-1", presentation: "anchor", visualIntent: "data", preferredOutputs: [] } } },
    chapterPlanPath: "chapter-plan.json", visualCatalogPath: "visuals.json", elementPath: "elements.json", chapterPath: "chapter.json",
  };
  for (const variant of CHART_VARIANTS) {
    const elementsPath = resolve(workDir, `${variant}-elements.json`);
    const catalogPath = resolve(workDir, `${variant}-catalog.json`);
    await writeFile(elementsPath, JSON.stringify({ sectionId: "s1", blocks: [chartFixture(variant, 0)] }));
    await writeFile(catalogPath, JSON.stringify({ sectionId: "s1", inputs: [{ requestId: `visual-${variant}`, kind: "dataset", status: "usable", sourceIds: ["s_1"], sourceUrls: ["https://example.test/data"], dataset: datasetForVariant(variant), limitations: [] }] }));
    const { stdout } = await execFileAsync(resolve(root, "node_modules/.bin/tsx"), [resolve(root, "scripts/validate-elements.ts")], { cwd: root, env: { ...process.env, WORK_JSON: JSON.stringify(workItem), ELEMENTS_FILE: elementsPath, VISUAL_CATALOG_FILE: catalogPath } });
    assert.match(stdout, /ELEMENTS_VALID/, `${variant} should pass shared workflow/renderer validation`);
  }
});

test("100%-stacked bar keeps each category once and normalizes each stack", () => {
  const block = chartFixture("100%-stacked-bar", 0);
  const model = buildChartModel(block, datasetForVariant("100%-stacked-bar"));
  assert.deepEqual(model.categories, ["2024", "2025"]);
  assert.deepEqual(model.options.series.map((series) => series.data.map((datum) => datum.value)), [[60, 75], [40, 25]]);
  for (const index of [0, 1]) assert.equal(model.options.series.reduce((sum, series) => { const value = series.data[index]?.value; return sum + (typeof value === "number" ? value : 0); }, 0), 100);
  assert.equal(model.hasForecast, true);
  assert.equal(model.options.yAxis.max, 100);
});

test("color/series dimensions form independent series instead of duplicate x categories", () => {
  const block = chartFixture("grouped-bar", 0);
  const model = buildChartModel(block, datasetForVariant("grouped-bar"));
  assert.deepEqual(model.categories, ["2024", "2025"]);
  assert.deepEqual(model.seriesValues, ["Color", "Mono"]);
  assert.equal(model.options.series[0].data.length, 2);
  assert.equal(model.options.series[1].data.length, 2);
});

test("line charts with one status per point stay connected and encode status at datum level", () => {
  const dataset: ChartDataset = {
    id: "status-line",
    title: "Revenue",
    fields: [
      { key: "year", label: "Year", type: "number" },
      { key: "revenue", label: "Revenue", type: "number", unit: "NT$ bn" },
      { key: "auditStatus", label: "Audit status", type: "category" },
    ],
    rows: [
      { year: 2023, revenue: 27.12, auditStatus: "published" },
      { year: 2024, revenue: 32.163, auditStatus: "audited" },
      { year: 2025, revenue: 36.116, auditStatus: "board-approved" },
    ],
  };
  const block = { ...chartFixture("line", 0), encoding: { x: "year", y: "revenue", color: "auditStatus" }, interaction: { tooltip: true, zoom: false, legendFilter: true } };
  const model = buildChartModel(block, dataset);
  assert.equal(model.pointColorKey, "auditStatus");
  assert.equal(model.options.series.length, 1);
  assert.deepEqual(model.options.series[0].data.map((datum) => datum.value), [27.12, 32.163, 36.116]);
  assert.equal(new Set(model.options.series[0].data.map((datum) => datum.itemStyle.color)).size, 3);
  assert.equal(model.options.legend.show, false);
  assert.deepEqual(model.seriesValues, ["Revenue"]);
});

test("legitimate zero-valued data remains a plotted zero", () => {
  const dataset = {
    id: "zero-value",
    title: "Zero value",
    fields: [{ key: "period", label: "Period", type: "category" as const }, { key: "value", label: "Value", type: "number" as const }],
    rows: [{ period: "2024", value: 0 }, { period: "2025", value: 5 }],
  };
  const block = { ...chartFixture("bar", 0), encoding: { x: "period", y: "value" }, interaction: { tooltip: true, zoom: false, legendFilter: false } };
  const model = buildChartModel(block, dataset);
  assert.deepEqual(model.options.series[0]?.data.map((datum) => datum?.value), [0, 5]);
});

test("annotation-only role rows stay outside the plotted series", () => {
  const dataset: ChartDataset = {
    id: "ownership",
    title: "Ownership",
    fields: [
      { key: "period", label: "Period", type: "category" },
      { key: "value", label: "Ownership", type: "number", unit: "%" },
      { key: "displayRole", label: "Display role", type: "category" },
      { key: "annotation", label: "Annotation", type: "category" },
    ],
    rows: [
      { period: "2015", value: 19, displayRole: "bar", annotation: "" },
      { period: "2016", value: 19, displayRole: "bar", annotation: "" },
      { period: "2023 other survey", value: 21, displayRole: "annotation-only", annotation: "Different population and methodology; not a continuation." },
    ],
  };
  const block = { ...chartFixture("bar", 0), encoding: { x: "period", y: "value", color: "displayRole" }, interaction: { tooltip: true, zoom: false, legendFilter: true } };
  const model = buildChartModel(block, dataset);
  assert.deepEqual(model.categories, ["2015", "2016"]);
  assert.equal(model.options.series.length, 1);
  assert.deepEqual(model.options.series[0].data.map((datum) => datum.value), [19, 19]);
  assert.deepEqual(model.seriesValues, ["Ownership"]);
  assert.equal(model.options.legend.show, false);
  assert.deepEqual(model.excludedAnnotations, [{ category: "2023 other survey", value: 21, note: "Different population and methodology; not a continuation." }]);
});

test("sparse status series remain missing instead of becoming synthetic zeroes", () => {
  const dataset: ChartDataset = {
    id: "sparse-status",
    title: "Actual and forecast",
    fields: [
      { key: "period", label: "Period", type: "category" },
      { key: "dataType", label: "Data type", type: "category" },
      { key: "value", label: "Modules", type: "number", unit: "million" },
    ],
    rows: [
      { period: "2024", dataType: "actual", value: 370 },
      { period: "2025", dataType: "forecast", value: 500 },
    ],
  };
  const block = {
    ...chartFixture("bar", 0),
    encoding: { x: "period", y: "value", color: "dataType" },
    interaction: { tooltip: true, zoom: false, legendFilter: true },
  };
  const model = buildChartModel(block, dataset);
  assert.deepEqual(model.categories, ["2024", "2025"]);
  assert.deepEqual(model.seriesValues, ["actual", "forecast"]);
  assert.deepEqual(model.options.series.map((series) => series.data.map((datum) => datum?.value ?? null)), [[370, null], [null, 500]]);
  assert.deepEqual(model.tableRows.map((row) => row.values.map((value) => value.value)), [[370, null], [null, 500]]);
  assert.equal(model.hasForecast, true);
  assert.equal(model.options.legend.show, false, "custom legend controls must not be duplicated by the ECharts legend");
  assert.doesNotMatch(model.options.aria.description, /\b0\b/);
});

test("rejects undeclared channels, non-numeric measures, duplicate cells, and impossible filter flags", () => {
  const block = chartFixture("line", 0); const dataset = datasetForVariant("line");
  assert.throws(() => validateChartContract({ ...block, encoding: { ...block.encoding, ignored: "value" } }, dataset), /unsupported encoding channel/);
  assert.throws(() => validateChartContract({ ...block, encoding: { ...block.encoding, y: "series" } }, dataset), /must reference a number field/);
  assert.throws(() => validateChartContract({ ...block, interaction: { tooltip: true, zoom: false, legendFilter: true }, encoding: { x: "period", y: "value" } }, dataset), /fewer than two series/);
  const duplicate = { ...dataset, rows: [...dataset.rows, { ...dataset.rows[0] }] };
  assert.throws(() => buildChartModel(block, duplicate), /duplicate x\/series cell/);
  assert.throws(() => buildChartModel({ ...block, variant: "heatmap", interaction: { tooltip: true, zoom: false, legendFilter: false }, encoding: { x: "period", y: "series", value: "series" } }, dataset), /must reference a number field/);
});

test("renderer emits every block and chart variant from a typed fixture", async () => {
  const work = await mkdtemp(resolve(tmpdir(), "odyssey-render-test-"));
  const documentPath = resolve(work, "document.json"); const outputPath = resolve(work, "report.html");
  await writeFile(documentPath, `${JSON.stringify(makeFixtureDocument())}\n`);
  const { stdout } = await execFileAsync("tsx", [resolve(root, "engine/render-report.ts")], { cwd: root, env: { ...process.env, DOCUMENT_FILE: documentPath, OUTPUT_PATH: outputPath } });
  assert.match(stdout, /REPORT_RENDERED/);
  const html = await readFile(outputPath, "utf8");
  for (const variant of CHART_VARIANTS) assert.match(html, new RegExp(`data-chart-variant=\\"${variant}`));
  for (const type of ["metric-strip", "table", "comparison", "timeline", "flow", "matrix", "callout", "quote"]) assert.match(html, new RegExp(`re-block-${type}`));
  assert.match(html, /data-metric-value="4 days"/);
  assert.match(html, /Data table/);
  assert.match(html, /data-odyssey="1"/);
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.doesNotMatch(visible, /undefined|\[object Object\]/);
});

test("compact navigation remains usable with twenty chapters on desktop and mobile", async () => {
  const work = await mkdtemp(resolve(tmpdir(), "odyssey-nav-test-"));
  const documentPath = resolve(work, "document.json"); const outputPath = resolve(work, "report.html");
  const reportDocument = makeFixtureDocument();
  const first = reportDocument.sections[0];
  if (!first) throw new Error("fixture section missing");
  reportDocument.sections = Array.from({ length: 20 }, (_, index) => ({ ...first, sectionId: `chapter-${index + 1}`, title: `Chapter ${String(index + 1).padStart(2, "0")} with a deliberately long navigation title`, modules: index === 0 ? first.modules : [] }));
  await writeFile(documentPath, `${JSON.stringify(reportDocument)}\n`);
  await execFileAsync("tsx", [resolve(root, "engine/render-report.ts")], { cwd: root, env: { ...process.env, DOCUMENT_FILE: documentPath, OUTPUT_PATH: outputPath } });
  const html = await readFile(outputPath, "utf8");
  assert.match(html, /data-nav-mode="compact"/);
  assert.equal((html.match(/class="re-nav-link"/g) ?? []).length, 20);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(pathToFileURL(outputPath).href, { waitUntil: "networkidle" });
      assert.ok(await page.locator(".re-current-section").isVisible());
      assert.equal(await page.locator(".re-toc-panel .re-nav-link").count(), 20);
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
      await page.locator(".re-toc summary").click();
      assert.ok(await page.locator(".re-toc-panel").isVisible());
      await page.locator(".re-toc-panel .re-nav-link").nth(9).click();
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".re-toc").evaluate((node) => (node as HTMLDetailsElement).open), false);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
