import { type Dataset, ElementPackage, SectionWorkItem, VisualCatalog } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";
import { validateChartContract } from "../engine/render-model.js";

const finish = (type: string, reason = ""): never => {
	console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } }));
	process.exit(0);
};
const invalid = (reason: string): never => finish("ELEMENTS_INVALID", reason);
let work!: ReturnType<typeof SectionWorkItem.parse>;
let elements!: ReturnType<typeof ElementPackage.parse>;
let catalog!: ReturnType<typeof VisualCatalog.parse>;
try {
	work = parseJsonText(process.env.WORK_JSON ?? "", SectionWorkItem, "WORK_JSON");
	[elements, catalog] = await Promise.all([
		parseJsonFile(process.env.ELEMENTS_FILE ?? "", ElementPackage),
		parseJsonFile(process.env.VISUAL_CATALOG_FILE ?? "", VisualCatalog),
	]);
} catch (error) {
	invalid(`Cannot read element inputs: ${error instanceof Error ? error.message : String(error)}`);
}
if (elements.sectionId !== work.sectionId || catalog.sectionId !== work.sectionId)
	invalid("element or visual catalog sectionId mismatch");
const beatIds = new Set(work.beats.map((beat) => beat.id));
const evidenceIds = new Set(work.beats.flatMap((beat) => beat.evidenceIds));
const visuals = new Map(catalog.inputs.map((entry) => [entry.requestId, entry]));
const blockIds = new Set<string>();
if (elements.blocks.length > work.experience.visualBudget) invalid("element package exceeds chapter visual budget");
for (const block of elements.blocks) {
	if (!block.id || blockIds.has(block.id)) invalid(`duplicate or empty block id ${block.id}`);
	blockIds.add(block.id);
	if (!beatIds.has(block.beatId)) invalid(`block ${block.id} references unknown beat`);
	for (const id of block.evidenceIds)
		if (!evidenceIds.has(id)) invalid(`block ${block.id} references unknown evidence ${id}`);
	if (block.type === "chart" || block.type === "metric-strip" || block.type === "table") {
		const visual = visuals.get(block.datasetRequestId);
		if (visual?.status !== "usable" || !visual.dataset) {
			invalid(`block ${block.id} has no usable dataset`);
			continue;
		}
		const dataset: Dataset = visual.dataset;
		const fields = new Set(dataset.fields.map((field) => field.key));
		if (block.type === "chart") {
			try {
				validateChartContract(block, dataset);
			} catch (error) {
				invalid(`block ${block.id}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (block.type === "table")
			for (const field of block.columns)
				if (!fields.has(field)) invalid(`block ${block.id} table references unknown dataset field ${field}`);
		if (block.type === "metric-strip")
			for (const metric of block.metrics) {
				if (!fields.has(metric.valueField))
					invalid(`block ${block.id}/${metric.label} references unknown value field ${metric.valueField}`);
				for (const field of Object.keys(metric.where))
					if (!fields.has(field))
						invalid(`block ${block.id}/${metric.label} selector references unknown field ${field}`);
				const matches = dataset.rows.filter((row) =>
					Object.entries(metric.where).every(([field, value]) => row[field] === value),
				);
				if (matches.length !== 1) invalid(`block ${block.id}/${metric.label} selector resolved ${matches.length} rows`);
				const value = matches[0]?.[metric.valueField];
				if (value === undefined || value === null || value === "")
					invalid(`block ${block.id}/${metric.label} resolved an empty value`);
			}
	}
	if (block.type === "image") {
		const visual = visuals.get(block.imageRequestId);
		if (visual?.status !== "usable" || !visual.image) invalid(`block ${block.id} has no usable image`);
	}
}
finish("ELEMENTS_VALID");
