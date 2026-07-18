import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const finish = (type, reason = "") => console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } }));
const invalid = (reason) => { finish("ELEMENTS_INVALID", reason); process.exit(0); };
let work, elements, catalog;
try {
  work = JSON.parse(process.env.WORK_JSON);
  [elements, catalog] = await Promise.all([
    readFile(resolve(process.cwd(), process.env.ELEMENTS_FILE), "utf8").then(JSON.parse),
    readFile(resolve(process.cwd(), process.env.VISUAL_CATALOG_FILE), "utf8").then(JSON.parse),
  ]);
} catch (error) { invalid(`Cannot read element inputs: ${error instanceof Error ? error.message : String(error)}`); }
if (elements.sectionId !== work.sectionId || catalog.sectionId !== work.sectionId) invalid("element or visual catalog sectionId mismatch");
const beatIds = new Set((work.beats ?? []).map((beat) => beat.id));
const evidenceIds = new Set((work.beats ?? []).flatMap((beat) => beat.evidenceIds ?? []));
const visuals = new Map((catalog.inputs ?? []).map((entry) => [entry.requestId, entry]));
const blockIds = new Set();
if ((elements.blocks ?? []).length > (work.experience.visualBudget ?? 0)) invalid("element package exceeds chapter visual budget");
for (const block of elements.blocks ?? []) {
  if (!block.id || blockIds.has(block.id)) invalid(`duplicate or empty block id ${block.id}`);
  blockIds.add(block.id);
  if (!beatIds.has(block.beatId)) invalid(`block ${block.id} references unknown beat`);
  for (const id of block.evidenceIds ?? []) if (!evidenceIds.has(id)) invalid(`block ${block.id} references unknown evidence ${id}`);
  if (["chart", "metric-strip", "table"].includes(block.type)) {
    const visual = visuals.get(block.datasetRequestId);
    if (!visual || visual.status !== "usable" || !visual.dataset) invalid(`block ${block.id} has no usable dataset`);
    const fields = new Set((visual.dataset.fields ?? []).map((field) => field.key));
    if (block.type === "chart") {
      for (const channel of ["x", "y"]) {
        const field = block.encoding?.[channel];
        if (typeof field !== "string" || !fields.has(field)) invalid(`block ${block.id} encoding.${channel} references unknown dataset field ${field}`);
      }
      if ((visual.dataset.rows ?? []).length === 0) invalid(`block ${block.id} chart dataset is empty`);
      if ((visual.dataset.rows ?? []).some((row) => !Number.isFinite(Number(row[block.encoding.y])))) invalid(`block ${block.id} encoding.y contains non-numeric values`);
    }
    if (block.type === "table") {
      for (const field of block.columns ?? []) if (!fields.has(field)) invalid(`block ${block.id} table references unknown dataset field ${field}`);
    }
    if (block.type === "metric-strip") {
      if (!Array.isArray(block.metrics) || block.metrics.length === 0) invalid(`block ${block.id} has no metric selectors`);
      for (const metric of block.metrics ?? []) {
        if (!fields.has(metric.valueField)) invalid(`block ${block.id}/${metric.label} references unknown value field ${metric.valueField}`);
        for (const field of Object.keys(metric.where ?? {})) if (!fields.has(field)) invalid(`block ${block.id}/${metric.label} selector references unknown field ${field}`);
        const matches = (visual.dataset.rows ?? []).filter((row) => Object.entries(metric.where ?? {}).every(([field, value]) => row[field] === value));
        if (matches.length !== 1) invalid(`block ${block.id}/${metric.label} selector resolved ${matches.length} rows`);
        const value = matches[0]?.[metric.valueField];
        if (value === undefined || value === null || value === "") invalid(`block ${block.id}/${metric.label} resolved an empty value`);
      }
    }
  }
  if (block.type === "image") {
    const visual = visuals.get(block.imageRequestId);
    if (!visual || visual.status !== "usable" || !visual.image) invalid(`block ${block.id} has no usable image`);
  }
}
finish("ELEMENTS_VALID");
