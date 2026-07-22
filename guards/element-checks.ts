import type { ChapterPlan, Dataset, ElementPackage, SectionWorkItem, VisualCatalog } from "../contracts/index.js";
import { validateChartDatasetBindings } from "../engine/render-model.js";
import { errorMessage } from "./runtime.js";

// Reports every violation in one pass so the generator can fix the whole
// package in a single regeneration instead of learning one defect per retry.
export type ElementCheckFailure = { kind: "invalid" | "patch-required"; reasons: string[] };

const VISUAL_BLOCK_TYPES = new Set(["chart", "metric-strip", "table", "image"]);

export function checkElementPackage(
	work: SectionWorkItem,
	elements: ElementPackage,
	catalog: VisualCatalog,
	chapterPlan: ChapterPlan | undefined,
): ElementCheckFailure | undefined {
	const invalid: string[] = [];
	const patchRequired: string[] = [];
	if (elements.sectionId !== work.sectionId || catalog.sectionId !== work.sectionId)
		invalid.push("element or visual catalog sectionId mismatch");
	const beatsById = new Map(work.beats.map((beat) => [beat.id, beat]));
	const visuals = new Map(catalog.inputs.map((entry) => [entry.requestId, entry]));
	const usedVisualIds = new Set<string>();
	const visualBlocks = elements.blocks.filter(
		(block) => VISUAL_BLOCK_TYPES.has(block.type) || block.fallbackRequestId !== undefined,
	).length;
	if (visualBlocks > work.experience.visualBudget)
		invalid.push(
			`element package exceeds chapter visual budget: ${visualBlocks} visual blocks > budget ${work.experience.visualBudget}`,
		);
	if (elements.blocks.length > work.maxBlocks)
		invalid.push(`element package exceeds chapter block cap: ${elements.blocks.length} blocks > cap ${work.maxBlocks}`);
	const blockIds = new Set<string>();
	for (const block of elements.blocks) {
		if (!block.id.trim() || blockIds.has(block.id)) invalid.push(`duplicate or empty block id ${block.id}`);
		blockIds.add(block.id);
		const beat = beatsById.get(block.beatId);
		if (!beat) {
			invalid.push(`block ${block.id} references unknown beat ${block.beatId}`);
			continue;
		}
		const beatEvidence = new Set(beat.evidenceIds);
		for (const id of block.evidenceIds)
			if (!beatEvidence.has(id))
				invalid.push(`block ${block.id} references evidence ${id} outside beat ${block.beatId}`);
		if (block.fallbackRequestId) {
			const visual = visuals.get(block.fallbackRequestId);
			const request = chapterPlan?.visualRequests[block.fallbackRequestId];
			if (visual?.status !== "not-found")
				invalid.push(`block ${block.id} fallbackRequestId must reference a not-found visual input`);
			if (!request || request.beatId !== block.beatId)
				invalid.push(`block ${block.id} fallback request does not match beat`);
			const expected =
				block.type === "callout" ? "callout" : block.type === "flow" || block.type === "matrix" ? "diagram" : "prose";
			if (request && request.fallback !== expected)
				invalid.push(`block ${block.id} fallback type ${expected} does not match request fallback ${request.fallback}`);
			usedVisualIds.add(block.fallbackRequestId);
		}
		if (block.type === "chart" || block.type === "metric-strip" || block.type === "table") {
			const visual = visuals.get(block.datasetRequestId);
			usedVisualIds.add(block.datasetRequestId);
			const request = chapterPlan?.visualRequests[block.datasetRequestId];
			if (request?.intent !== "dataset-backed" || request.required !== true || request.beatId !== block.beatId)
				invalid.push(`block ${block.id} uses a request not declared dataset-backed and required`);
			if (visual?.status !== "usable" || !visual.dataset) {
				invalid.push(`block ${block.id} has no usable dataset`);
				continue;
			}
			const dataset: Dataset = visual.dataset;
			const fields = new Set(dataset.fields.map((field) => field.key));
			if (block.type === "chart") {
				try {
					validateChartDatasetBindings(block, dataset);
				} catch (error) {
					invalid.push(`block ${block.id}: ${errorMessage(error)}`);
				}
				if (request?.preferredOutput !== block.variant && request?.preferredOutput !== "table")
					invalid.push(`block ${block.id} uses variant ${block.variant} not requested by ${block.datasetRequestId}`);
			}
			if (block.type === "table")
				for (const field of block.columns)
					if (!fields.has(field)) invalid.push(`block ${block.id} table references unknown dataset field ${field}`);
			if (block.type === "metric-strip")
				for (const metric of block.metrics) {
					if (!fields.has(metric.valueField)) {
						invalid.push(`block ${block.id}/${metric.label} references unknown value field ${metric.valueField}`);
						continue;
					}
					const unknownSelectors = Object.keys(metric.where).filter((field) => !fields.has(field));
					if (unknownSelectors.length > 0) {
						invalid.push(
							`block ${block.id}/${metric.label} selector references unknown fields ${unknownSelectors.join(", ")}`,
						);
						continue;
					}
					const matches = dataset.rows.filter((row) =>
						Object.entries(metric.where).every(([field, value]) => row[field] === value),
					);
					if (matches.length !== 1) {
						invalid.push(`block ${block.id}/${metric.label} selector resolved ${matches.length} rows`);
						continue;
					}
					if (
						matches[0]?.[metric.valueField] === undefined ||
						matches[0]?.[metric.valueField] === null ||
						matches[0]?.[metric.valueField] === ""
					)
						invalid.push(`block ${block.id}/${metric.label} resolved an empty value`);
				}
		}
		if (block.type === "image") {
			const visual = visuals.get(block.imageRequestId);
			const request = chapterPlan?.visualRequests[block.imageRequestId];
			usedVisualIds.add(block.imageRequestId);
			if (request?.intent !== "dataset-backed" || request.required !== true || request.beatId !== block.beatId)
				invalid.push(`image block ${block.id} request is inconsistent with its beat intent`);
			if (visual?.status !== "usable" || !visual.image) invalid.push(`block ${block.id} has no usable image`);
		}
	}
	for (const input of catalog.inputs) {
		if (usedVisualIds.has(input.requestId)) continue;
		const message = `${input.status} visual input ${input.requestId} has no guaranteed element use`;
		if (input.status === "not-found") patchRequired.push(message);
		else invalid.push(message);
	}
	if (invalid.length > 0) return { kind: "invalid", reasons: [...invalid, ...patchRequired] };
	if (patchRequired.length > 0) return { kind: "patch-required", reasons: patchRequired };
	return undefined;
}
