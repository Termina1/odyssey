import {
	Dataset,
	type DatasetField,
	ReportDocument,
	type ReportDocument as ReportDocumentType,
	type RichBlock,
	VisualInput,
} from "../contracts/index.js";
import { type ChartBlock, CHART_VARIANTS as MODEL_VARIANTS } from "../engine/render-model.js";

export const CHART_VARIANTS = [...MODEL_VARIANTS] as const;
type Variant = (typeof CHART_VARIANTS)[number];
type Row = Record<string, string | number | boolean>;
const base = (id: string, title: string, fields: DatasetField[], rows: Row[]): Dataset =>
	Dataset.parse({
		id,
		title,
		description: title,
		fields,
		rows,
		provenance: [
			{ sourceUrl: "https://example.test/data", evidenceId: "e_1", extractionNote: "deterministic fixture" },
		],
		limitations: [],
	});
export function datasetForVariant(variant: Variant): Dataset {
	if (["line", "area"].includes(variant))
		return base(
			`d-${variant}`,
			variant,
			[
				{ key: "period", label: "Period", type: "date" },
				{ key: "value", label: "Value", type: "number", unit: "units" },
				{ key: "series", label: "Series", type: "category" },
			],
			[
				{ period: "2024", value: 10, series: "A" },
				{ period: "2024", value: 8, series: "B" },
				{ period: "2025", value: 18, series: "A" },
				{ period: "2025", value: 12, series: "B" },
			],
		);
	if (["bar", "grouped-bar", "stacked-bar", "100%-stacked-bar"].includes(variant))
		return base(
			`d-${variant}`,
			variant,
			[
				{ key: "year", label: "Year", type: "category" },
				{ key: "type", label: "Type", type: "category" },
				{ key: "value", label: "Share", type: "number", unit: "%" },
				{ key: "forecast", label: "Forecast", type: "boolean" },
			],
			[
				{ year: "2024", type: "Color", value: 60, forecast: false },
				{ year: "2024", type: "Mono", value: 40, forecast: false },
				{ year: "2025", type: "Color", value: 75, forecast: true },
				{ year: "2025", type: "Mono", value: 25, forecast: true },
			],
		);
	if (["scatter", "bubble"].includes(variant))
		return base(
			`d-${variant}`,
			variant,
			[
				{ key: "x", label: "X", type: "number", unit: "ms" },
				{ key: "y", label: "Y", type: "number", unit: "%" },
				{ key: "size", label: "Size", type: "number" },
				{ key: "series", label: "Series", type: "category" },
				{ key: "name", label: "Name", type: "category" },
			],
			[
				{ x: 1, y: 10, size: 3, series: "A", name: "One" },
				{ x: 2, y: 18, size: 8, series: "A", name: "Two" },
				{ x: 1, y: 14, size: 5, series: "B", name: "Three" },
				{ x: 2, y: 22, size: 11, series: "B", name: "Four" },
			],
		);
	if (variant === "heatmap")
		return base(
			"d-heatmap",
			variant,
			[
				{ key: "x", label: "X", type: "category" },
				{ key: "y", label: "Y", type: "category" },
				{ key: "value", label: "Value", type: "number", unit: "%" },
			],
			[
				{ x: "A", y: "Low", value: 10 },
				{ x: "A", y: "High", value: 24 },
				{ x: "B", y: "Low", value: 16 },
				{ x: "B", y: "High", value: 30 },
			],
		);
	if (["treemap", "sunburst"].includes(variant))
		return base(
			`d-${variant}`,
			variant,
			[
				{ key: "name", label: "Name", type: "category" },
				{ key: "value", label: "Value", type: "number", unit: "units" },
			],
			[
				{ name: "Alpha", value: 20 },
				{ name: "Beta", value: 35 },
				{ name: "Gamma", value: 15 },
			],
		);
	if (variant === "sankey")
		return base(
			"d-sankey",
			variant,
			[
				{ key: "source", label: "Source", type: "category" },
				{ key: "target", label: "Target", type: "category" },
				{ key: "value", label: "Value", type: "number", unit: "units" },
			],
			[
				{ source: "A", target: "B", value: 8 },
				{ source: "A", target: "C", value: 4 },
				{ source: "B", target: "D", value: 6 },
			],
		);
	throw new Error(`No fixture dataset for ${variant}`);
}
const encodings: Record<Variant, Record<string, string>> = {
	line: { x: "period", y: "value", series: "series" },
	area: { x: "period", y: "value", color: "series" },
	bar: { x: "year", y: "value", series: "type" },
	"grouped-bar": { x: "year", y: "value", series: "type" },
	"stacked-bar": { x: "year", y: "value", color: "type", forecast: "forecast" },
	"100%-stacked-bar": { x: "year", y: "value", color: "type", forecast: "forecast" },
	scatter: { x: "x", y: "y", series: "series", name: "name" },
	bubble: { x: "x", y: "y", series: "series", size: "size", name: "name" },
	heatmap: { x: "x", y: "y", value: "value" },
	treemap: { name: "name", value: "value" },
	sunburst: { name: "name", value: "value" },
	sankey: { source: "source", target: "target", value: "value" },
};
export function chartFixture(variant: Variant, index: number): ChartBlock {
	return {
		id: `chart-${variant}-${index}`,
		beatId: "beat-1",
		type: "chart",
		title: `${variant} fixture`,
		purpose: `Render ${variant} semantics`,
		evidenceIds: ["e_1"],
		datasetRequestId: `visual-${variant}`,
		variant,
		encoding: encodings[variant],
		annotations: variant === "100%-stacked-bar" ? [{ label: "Forecast", x: "2025", y: 100 }] : [],
		interaction: {
			tooltip: true,
			zoom: ["line", "scatter", "bubble", "heatmap"].includes(variant),
			legendFilter: ["line", "area", "grouped-bar", "stacked-bar", "100%-stacked-bar", "scatter", "bubble"].includes(
				variant,
			),
		},
	};
}
export function makeFixtureDocument({ imagePath }: { imagePath?: string } = {}): ReportDocumentType {
	const variants: Variant[] = [...CHART_VARIANTS];
	const visuals = variants.map((variant) =>
		VisualInput.parse({
			requestId: `visual-${variant}`,
			kind: "dataset",
			status: "usable",
			sourceIds: ["s_1"],
			sourceUrls: ["https://example.test/data"],
			dataset: datasetForVariant(variant),
			limitations: [],
		}),
	);
	visuals.push(
		VisualInput.parse({
			requestId: "visual-metric",
			kind: "dataset",
			status: "usable",
			sourceIds: ["s_1"],
			sourceUrls: ["https://example.test/data"],
			dataset: base(
				"d-metric",
				"Metrics",
				[
					{ key: "name", label: "Metric", type: "category" },
					{ key: "value", label: "Value", type: "category", unit: "days" },
				],
				[
					{ name: "before", value: "4 days" },
					{ name: "after", value: "10 minutes" },
				],
			),
			limitations: [],
		}),
	);
	visuals.push(
		VisualInput.parse({
			requestId: "visual-table",
			kind: "dataset",
			status: "usable",
			sourceIds: ["s_1"],
			sourceUrls: ["https://example.test/data"],
			dataset: datasetForVariant("bar"),
			limitations: [],
		}),
	);
	if (imagePath)
		visuals.push(
			VisualInput.parse({
				requestId: "visual-image",
				kind: "image",
				status: "usable",
				sourceIds: ["s_1"],
				sourceUrls: ["https://example.test/data"],
				image: {
					localPath: imagePath,
					sourceUrl: "https://example.test/image",
					sourcePageUrl: "https://example.test",
					attribution: "Fixture",
					license: "CC0",
					mimeType: "image/png",
					alt: "Fixture image",
					caption: "Fixture image",
				},
				limitations: [],
			}),
		);
	const blocks: RichBlock[] = variants.map((variant, index) => chartFixture(variant, index));
	blocks.push({
		id: "metric-1",
		beatId: "beat-1",
		type: "metric-strip",
		title: "Metrics",
		purpose: "Show metrics",
		evidenceIds: ["e_1"],
		datasetRequestId: "visual-metric",
		metrics: [
			{ label: "Before", valueField: "value", where: { name: "before" } },
			{ label: "After", valueField: "value", where: { name: "after" } },
		],
	});
	blocks.push({
		id: "table-1",
		beatId: "beat-1",
		type: "table",
		title: "Table",
		purpose: "Show rows",
		evidenceIds: ["e_1"],
		datasetRequestId: "visual-table",
		columns: ["year", "type", "value"],
	});
	blocks.push({
		id: "comparison-1",
		beatId: "beat-1",
		type: "comparison",
		title: "Comparison",
		purpose: "Compare",
		evidenceIds: ["e_1"],
		columns: [
			{ title: "A", body: "One" },
			{ title: "B", body: "Two" },
		],
	});
	blocks.push({
		id: "timeline-1",
		beatId: "beat-1",
		type: "timeline",
		title: "Timeline",
		purpose: "Sequence",
		evidenceIds: ["e_1"],
		items: [
			{ label: "Now", body: "First" },
			{ label: "Next", body: "Second" },
		],
	});
	blocks.push({
		id: "flow-1",
		beatId: "beat-1",
		type: "flow",
		title: "Flow",
		purpose: "Flow",
		evidenceIds: ["e_1"],
		steps: [
			{ label: "Input", body: "First" },
			{ label: "Output", body: "Second" },
		],
	});
	blocks.push({
		id: "matrix-1",
		beatId: "beat-1",
		type: "matrix",
		title: "Matrix",
		purpose: "Map",
		evidenceIds: ["e_1"],
		cells: [
			{ x: "A", y: "1", title: "A1", body: "One" },
			{ x: "A", y: "2", title: "A2", body: "Two" },
			{ x: "B", y: "1", title: "B1", body: "Three" },
			{ x: "B", y: "2", title: "B2", body: "Four" },
		],
	});
	blocks.push({
		id: "callout-1",
		beatId: "beat-1",
		type: "callout",
		title: "Callout",
		purpose: "Note",
		evidenceIds: ["e_1"],
		tone: "warning",
		body: "Important",
		bullets: ["One"],
	});
	blocks.push({
		id: "quote-1",
		beatId: "beat-1",
		type: "quote",
		title: "Quote",
		purpose: "Quote",
		evidenceIds: ["e_1"],
		quote: "A statement.",
		attribution: "Source",
	});
	if (imagePath)
		blocks.push({
			id: "image-1",
			beatId: "beat-1",
			type: "image",
			title: "Image",
			purpose: "Image",
			evidenceIds: ["e_1"],
			imageRequestId: "visual-image",
			alt: "Fixture image",
			caption: "Fixture",
		});
	const blockGroups = Array.from({ length: Math.ceil(blocks.length / 6) }, (_, index) =>
		blocks.slice(index * 6, index * 6 + 6),
	);
	const planSections = blockGroups.map((_, index) => ({
		id: `s${index + 1}`,
		title: `Fixture section ${index + 1}`,
		purpose: "Test",
		evidenceIds: ["e_1"],
		beatIds: ["beat-1"],
	}));
	const experienceSections = Object.fromEntries(
		blockGroups.map((group, index) => {
			const sectionId = `s${index + 1}`;
			return [
				sectionId,
				{
					sectionId,
					layout: "split" as const,
					openingMode: "claim" as const,
					openingClaim: "Claim",
					handoff: "Next",
					visualBudget: group.length,
					beats: {
						"beat-1": {
							beatId: "beat-1",
							presentation: "anchor" as const,
							visualIntent: "data" as const,
							preferredOutputs: [],
						},
					},
				},
			];
		}),
	);
	const sections = blockGroups.map((group, index) => ({
		sectionId: `s${index + 1}`,
		title: `Fixture section ${index + 1}`,
		dek: "Fixture",
		openingClaim: "Claim",
		modules: [
			{
				beatId: "beat-1",
				headline: "Fixture module",
				body: "Body",
				presentation: "anchor" as const,
				layout: "split" as const,
				blockIds: group.map((block) => block.id),
				evidenceIds: ["e_1"],
			},
		],
		handoff: "Next",
	}));
	const elements = blockGroups.map((group, index) => ({ sectionId: `s${index + 1}`, blocks: group }));
	return ReportDocument.parse({
		version: "1",
		meta: { title: "Renderer fixture", objective: "Test", thesis: "Typed output", readerQuestion: "How?" },
		plan: {
			title: "Renderer fixture",
			objective: "Test",
			thesis: "Typed output",
			readerQuestion: "How?",
			sections: planSections,
			beats: [],
			exclusions: [],
			styleNotes: [],
		},
		experience: {
			direction: "Editorial",
			density: "balanced",
			globalRules: {
				maxBlocksPerBeat: 2,
				maxBlocksPerSection: 6,
				avoidRepeatedTypes: false,
				progressiveEvidenceDisclosure: true,
			},
			sections: experienceSections,
		},
		sections,
		elements,
		evidence: {
			evidence: [
				{
					id: "e_1",
					claim: "Fixture claim",
					sourceIds: ["s_1"],
					confidence: "high",
					caveat: "Fixture",
					tags: [],
					takeIds: [],
				},
			],
			sources: [
				{
					id: "s_1",
					title: "Fixture source",
					url: "https://example.test/data",
					publisher: "Example",
					sourceType: "official",
				},
			],
			contradictions: [],
			gaps: [],
			counts: { takes: 1, evidence: 1, sources: 1 },
		},
		visualInputs: visuals,
	});
}
