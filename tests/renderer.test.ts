import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import {
	buildChartModel,
	type ChartDataset,
	formatModelValue,
	imageMime,
	inferForecastKey,
	validateChartContract,
} from "../engine/render-model.js";
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

test("cyclic Sankey inputs are rendered as an acyclic flow with explicit return nodes", () => {
	const dataset = structuredClone(datasetForVariant("sankey"));
	dataset.rows.push({ source: "D", target: "A", value: 2 });
	const block = chartFixture("sankey", 0);
	block.interaction = { ...block.interaction, zoom: true };
	const model = buildChartModel(block, dataset);
	assert.equal(model.options.dataZoom, undefined);
	const series = model.options.series[0] as (typeof model.options.series)[number] & {
		links: Array<{ source: string; target: string; value: number }>;
	};
	assert.ok(series.links.some((link) => link.target.includes("↩")));
	const adjacency = new Map<string, string[]>();
	for (const link of series.links) adjacency.set(link.source, [...(adjacency.get(link.source) ?? []), link.target]);
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const hasCycle = (node: string): boolean => {
		if (visiting.has(node)) return true;
		if (visited.has(node)) return false;
		visiting.add(node);
		for (const next of adjacency.get(node) ?? []) if (hasCycle(next)) return true;
		visiting.delete(node);
		visited.add(node);
		return false;
	};
	assert.equal(
		[...adjacency.keys()].some((node) => hasCycle(node)),
		false,
	);
});

test("duplicate heatmap rows are averaged into one encoded cell", () => {
	const dataset = structuredClone(datasetForVariant("heatmap"));
	dataset.rows.push({ x: "A", y: "Low", value: 30 });
	const model = buildChartModel(chartFixture("heatmap", 0), dataset);
	const lowRow = model.tableRows.find((row) => row.category === "Low");
	assert.equal(lowRow?.values.find((value) => value.series === "A")?.value, 20);
	assert.match(model.options.aria.description, /duplicate row/);
});

test("workflow element validation accepts every renderer chart variant", async () => {
	const workDir = await mkdtemp(resolve(tmpdir(), "odyssey-element-variants-"));
	const workItem = {
		sectionId: "s1",
		index: 0,
		section: { id: "s1", title: "Section", purpose: "Test", evidenceIds: ["e_1"], beatIds: ["beat-1"] },
		beats: [
			{
				id: "beat-1",
				index: 0,
				sectionId: "s1",
				narrativePurpose: "Test",
				verdict: "supported",
				takeaway: "Takeaway",
				evidenceIds: ["e_1"],
				confidence: 1,
				caveat: "",
				notes: [],
			},
		],
		experience: {
			sectionId: "s1",
			layout: "split",
			openingMode: "claim",
			openingClaim: "Claim",
			handoff: "Next",
			visualBudget: 1,
			beats: { "beat-1": { beatId: "beat-1", presentation: "anchor", visualIntent: "data", preferredOutputs: [] } },
		},
		chapterPlanPath: resolve(workDir, "chapter-plan.json"),
		visualCatalogPath: "visuals.json",
		elementPath: "elements.json",
		chapterPath: "chapter.json",
	};
	for (const variant of CHART_VARIANTS) {
		await writeFile(
			resolve(workDir, "chapter-plan.json"),
			JSON.stringify({
				sectionId: "s1",
				layout: "split",
				openingClaim: "Claim",
				handoff: "Next",
				elementIntents: {
					"beat-1": { beatId: "beat-1", mode: "dataset-backed", output: variant, guaranteedUse: true },
				},
				visualRequests: {
					[`visual-${variant}`]: {
						id: `visual-${variant}`,
						sectionId: "s1",
						beatId: "beat-1",
						kind: "dataset",
						purpose: "Test",
						question: "Test",
						evidenceIds: ["e_1"],
						preferredOutput: variant,
						requirements: [],
						fallback: "prose",
						intent: "dataset-backed",
						required: true,
					},
				},
			}),
		);
		const elementsPath = resolve(workDir, `${variant}-elements.json`);
		const catalogPath = resolve(workDir, `${variant}-catalog.json`);
		await writeFile(elementsPath, JSON.stringify({ sectionId: "s1", blocks: [chartFixture(variant, 0)] }));
		await writeFile(
			catalogPath,
			JSON.stringify({
				sectionId: "s1",
				inputs: [
					{
						requestId: `visual-${variant}`,
						kind: "dataset",
						status: "usable",
						sourceIds: ["s_1"],
						sourceUrls: ["https://example.test/data"],
						dataset: datasetForVariant(variant),
						limitations: [],
					},
				],
			}),
		);
		const { stdout } = await execFileAsync(
			resolve(root, "node_modules/.bin/tsx"),
			[resolve(root, "guards/validate-elements.ts")],
			{
				cwd: root,
				env: {
					...process.env,
					WORK_JSON: JSON.stringify(workItem),
					ELEMENTS_FILE: elementsPath,
					VISUAL_CATALOG_FILE: catalogPath,
				},
			},
		);
		assert.match(stdout, /ELEMENTS_VALID/, `${variant} should pass shared workflow/renderer validation`);
	}
});

test("100%-stacked bar keeps each category once and normalizes each stack", () => {
	const block = chartFixture("100%-stacked-bar", 0);
	const model = buildChartModel(block, datasetForVariant("100%-stacked-bar"));
	assert.deepEqual(model.categories, ["2024", "2025"]);
	assert.deepEqual(
		model.options.series.map((series) => series.data.map((datum) => datum.value)),
		[
			[60, 75],
			[40, 25],
		],
	);
	for (const index of [0, 1])
		assert.equal(
			model.options.series.reduce((sum, series) => {
				const value = series.data[index]?.value;
				return sum + (typeof value === "number" ? value : 0);
			}, 0),
			100,
		);
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
	const block = {
		...chartFixture("line", 0),
		encoding: { x: "year", y: "revenue", color: "auditStatus" },
		interaction: { tooltip: true, zoom: false, legendFilter: true },
	};
	const model = buildChartModel(block, dataset);
	assert.equal(model.pointColorKey, "auditStatus");
	assert.equal(model.options.series.length, 1);
	assert.deepEqual(
		model.options.series[0].data.map((datum) => datum.value),
		[27.12, 32.163, 36.116],
	);
	assert.equal(new Set(model.options.series[0].data.map((datum) => datum.itemStyle.color)).size, 3);
	assert.equal(model.options.legend.show, false);
	assert.deepEqual(model.seriesValues, ["Revenue"]);
});

test("legitimate zero-valued data remains a plotted zero", () => {
	const dataset = {
		id: "zero-value",
		title: "Zero value",
		fields: [
			{ key: "period", label: "Period", type: "category" as const },
			{ key: "value", label: "Value", type: "number" as const },
		],
		rows: [
			{ period: "2024", value: 0 },
			{ period: "2025", value: 5 },
		],
	};
	const block = {
		...chartFixture("bar", 0),
		encoding: { x: "period", y: "value" },
		interaction: { tooltip: true, zoom: false, legendFilter: false },
	};
	const model = buildChartModel(block, dataset);
	assert.deepEqual(
		model.options.series[0]?.data.map((datum) => datum?.value),
		[0, 5],
	);
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
			{
				period: "2023 other survey",
				value: 21,
				displayRole: "annotation-only",
				annotation: "Different population and methodology; not a continuation.",
			},
		],
	};
	const block = {
		...chartFixture("bar", 0),
		encoding: { x: "period", y: "value", color: "displayRole" },
		interaction: { tooltip: true, zoom: false, legendFilter: true },
	};
	const model = buildChartModel(block, dataset);
	assert.deepEqual(model.categories, ["2015", "2016"]);
	assert.equal(model.options.series.length, 1);
	assert.deepEqual(
		model.options.series[0].data.map((datum) => datum.value),
		[19, 19],
	);
	assert.deepEqual(model.seriesValues, ["Ownership"]);
	assert.equal(model.options.legend.show, false);
	assert.deepEqual(model.excludedAnnotations, [
		{ category: "2023 other survey", value: 21, note: "Different population and methodology; not a continuation." },
	]);
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
	assert.deepEqual(
		model.options.series.map((series) => series.data.map((datum) => datum?.value ?? null)),
		[
			[370, null],
			[null, 500],
		],
	);
	assert.deepEqual(
		model.tableRows.map((row) => row.values.map((value) => value.value)),
		[
			[370, null],
			[null, 500],
		],
	);
	assert.equal(model.hasForecast, true);
	assert.equal(model.options.legend.show, false, "custom legend controls must not be duplicated by the ECharts legend");
	assert.doesNotMatch(model.options.aria.description, /\b0\b/);
});

test("rejects undeclared channels, non-numeric measures, and duplicate cells; coerces single-series legend filters", () => {
	const block = chartFixture("line", 0);
	const dataset = datasetForVariant("line");
	assert.throws(
		() => validateChartContract({ ...block, encoding: { ...block.encoding, ignored: "value" } }, dataset),
		/unsupported encoding channel/,
	);
	assert.throws(
		() => validateChartContract({ ...block, encoding: { ...block.encoding, y: "series" } }, dataset),
		/must reference a number field/,
	);
	const singleSeriesFilter = buildChartModel(
		{
			...block,
			interaction: { tooltip: true, zoom: false, legendFilter: true },
		},
		{ ...dataset, rows: dataset.rows.filter((row) => row.series === "A") },
	);
	assert.equal(
		singleSeriesFilter.seriesValues.length <= 1 || singleSeriesFilter.options.legend.show === false,
		true,
		"legendFilter with a single series must degrade gracefully instead of failing the render",
	);
	const duplicate = { ...dataset, rows: [...dataset.rows, { ...dataset.rows[0] }] };
	assert.throws(() => buildChartModel(block, duplicate), /duplicate x\/series cell/);
	assert.throws(
		() =>
			buildChartModel(
				{
					...block,
					variant: "heatmap",
					interaction: { tooltip: true, zoom: false, legendFilter: false },
					encoding: { x: "period", y: "series", value: "series" },
				},
				dataset,
			),
		/must reference a number field/,
	);
});

test("percent formatting matches share labels but never currency words", () => {
	assert.equal(formatModelValue(42, { label: "Доля рынка" }), "42%");
	assert.equal(formatModelValue(42, { label: "Share, percent" }), "42%");
	assert.equal(formatModelValue(42, { label: "Доллары США", unit: "USD" }), "42 USD");
	assert.equal(formatModelValue(42, { label: "Млн долларов" }), "42");
});

test("mime hints are sanitized before entering the data URI", () => {
	assert.equal(imageMime("/tmp/a.png", 'image/png"><script>x</script>'), "image/png");
	assert.equal(imageMime("/tmp/a.jpg", undefined), "image/jpeg");
	assert.equal(imageMime("/tmp/a.png", "image/webp"), "image/webp");
});

test("forecast keys are inferred only from forecast-named fields, never any lone boolean", () => {
	const block = chartFixture("line", 0);
	const fields = [
		{ key: "period", label: "Period", type: "date" as const },
		{ key: "value", label: "Value", type: "number" as const },
	];
	const unrelatedBoolean: ChartDataset = {
		id: "d1",
		title: "t",
		fields: [...fields, { key: "isPublic", label: "Public", type: "boolean" as const }],
		rows: [{ period: "2024", value: 1, isPublic: true }],
	};
	const named: ChartDataset = {
		id: "d2",
		title: "t",
		fields: [...fields, { key: "forecast", label: "Прогноз", type: "boolean" as const }],
		rows: [{ period: "2024", value: 1, forecast: true }],
	};
	const bare = { ...block, encoding: { x: "period", y: "value" }, forecast: undefined };
	assert.equal(inferForecastKey(unrelatedBoolean, bare), undefined);
	assert.equal(inferForecastKey(named, bare), "forecast");
});

test("annotation-only rows without numeric values do not abort the render", () => {
	const dataset = structuredClone(datasetForVariant("line"));
	dataset.rows.push({ period: "2026", value: "", series: "annotation-only" });
	const block = chartFixture("line", 0);
	const model = buildChartModel(block, dataset);
	assert.equal(model.excludedAnnotations?.length, 1);
	assert.equal(model.excludedAnnotations?.[0]?.value, null);
});

test("heatmap keeps absent cells missing instead of plotting zeroes", () => {
	const dataset = structuredClone(datasetForVariant("heatmap"));
	const removed = dataset.rows.pop();
	assert.ok(removed);
	const block = chartFixture("heatmap", 0);
	const model = buildChartModel(block, dataset);
	const flatValues = model.tableRows.flatMap((row) => row.values);
	assert.ok(
		flatValues.some((value) => value.missing === true && value.value === null),
		"removed cell must surface as missing, not zero",
	);
	const plotted = model.options.series[0]?.data ?? [];
	assert.equal(
		plotted.length,
		flatValues.filter((value) => !value.missing).length,
		"absent cells must not be plotted at all",
	);
});

test("renderer emits every block and chart variant from a typed fixture", async () => {
	const work = await mkdtemp(resolve(tmpdir(), "odyssey-render-test-"));
	const documentPath = resolve(work, "document.json");
	const outputPath = resolve(work, "report.html");
	const reviewPath = resolve(work, "render-review.json");
	await writeFile(documentPath, `${JSON.stringify(makeFixtureDocument())}\n`);
	const { stdout } = await execFileAsync("tsx", [resolve(root, "engine/render-report.ts")], {
		cwd: root,
		env: { ...process.env, DOCUMENT_FILE: documentPath, OUTPUT_PATH: outputPath, REVIEW_OUTPUT_PATH: reviewPath },
	});
	assert.match(stdout, /REPORT_RENDERED/);
	const review = JSON.parse(await readFile(reviewPath, "utf8")) as { pass: boolean; findings: unknown[] };
	assert.deepEqual(review, { pass: true, findings: [] });
	const html = await readFile(outputPath, "utf8");
	for (const variant of CHART_VARIANTS) assert.match(html, new RegExp(`data-chart-variant=\\"${variant}`));
	for (const type of ["metric-strip", "table", "comparison", "timeline", "flow", "matrix", "callout", "quote"])
		assert.match(html, new RegExp(`re-block-${type}`));
	assert.match(html, /data-metric-value="4 days"/);
	assert.match(html, /Data table/);
	assert.match(html, /data-odyssey="1"/);
	const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
	assert.doesNotMatch(visible, /undefined|\[object Object\]/);
});

test("compact navigation remains usable with twenty chapters on desktop and mobile", async () => {
	const work = await mkdtemp(resolve(tmpdir(), "odyssey-nav-test-"));
	const documentPath = resolve(work, "document.json");
	const outputPath = resolve(work, "report.html");
	const reportDocument = makeFixtureDocument();
	const first = reportDocument.sections[0];
	if (!first) throw new Error("fixture section missing");
	reportDocument.sections = Array.from({ length: 20 }, (_, index) => ({
		...first,
		sectionId: `chapter-${index + 1}`,
		title: `Chapter ${String(index + 1).padStart(2, "0")} with a deliberately long navigation title`,
		modules: [],
	}));
	reportDocument.elements = [];
	await writeFile(documentPath, `${JSON.stringify(reportDocument)}\n`);
	await execFileAsync("tsx", [resolve(root, "engine/render-report.ts")], {
		cwd: root,
		env: {
			...process.env,
			DOCUMENT_FILE: documentPath,
			OUTPUT_PATH: outputPath,
			REVIEW_OUTPUT_PATH: resolve(work, "render-review.json"),
		},
	});
	const html = await readFile(outputPath, "utf8");
	assert.match(html, /data-nav-mode="compact"/);
	assert.equal((html.match(/class="re-nav-link"/g) ?? []).length, 20);
	const browser = await chromium.launch({ headless: true });
	try {
		for (const viewport of [
			{ width: 1440, height: 900 },
			{ width: 390, height: 844 },
		]) {
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
