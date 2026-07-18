import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { EvidenceIndex, VisualInput, VisualRequest } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";

const finish = (type: string, reason = ""): never => { console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } })); process.exit(0); };
const invalid = (reason: string): never => finish("VISUAL_INPUT_INVALID", reason);
const requireDataset = (value: ReturnType<typeof VisualInput.parse>["dataset"]): NonNullable<ReturnType<typeof VisualInput.parse>["dataset"]> => { if (value) return value; invalid("usable dataset request has no plot-ready rows"); throw new Error("unreachable"); };
const requireImage = (value: ReturnType<typeof VisualInput.parse>["image"]): NonNullable<ReturnType<typeof VisualInput.parse>["image"]> => { if (value) return value; invalid("usable image request has no localPath"); throw new Error("unreachable"); };
let request!: ReturnType<typeof VisualRequest.parse>;
let input!: ReturnType<typeof VisualInput.parse>;
let evidence!: ReturnType<typeof EvidenceIndex.parse>;
try {
  request = parseJsonText(process.env.REQUEST_JSON ?? "", VisualRequest, "REQUEST_JSON");
  [input, evidence] = await Promise.all([parseJsonFile(process.env.INPUT_FILE ?? "", VisualInput), parseJsonFile(process.env.EVIDENCE_FILE ?? "", EvidenceIndex)]);
} catch (error) { invalid(`Cannot read visual input: ${error instanceof Error ? error.message : String(error)}`); }
if (input.requestId !== request.id) invalid(`requestId mismatch for ${request.id}`);
if (input.kind !== request.kind) invalid(`kind mismatch for ${request.id}`);
const requestedEvidence = new Set(request.evidenceIds);
const allowedSourceIds = new Set(evidence.evidence.filter((entry) => requestedEvidence.has(entry.id)).flatMap((entry) => entry.sourceIds));
for (const sourceId of input.sourceIds) {
  if (sourceId.startsWith("e_")) invalid(`sourceIds contains evidence ID ${sourceId}; use only source-record IDs with the s_ prefix, and put evidence IDs in dataset.provenance[].evidenceId`);
  if (!allowedSourceIds.has(sourceId)) invalid(`visual input references unrelated source record ${sourceId}`);
}
for (const entry of input.dataset?.provenance ?? []) if (entry.evidenceId !== undefined && !requestedEvidence.has(entry.evidenceId)) invalid(`dataset provenance references unrelated evidence ${entry.evidenceId}`);
if (input.status === "usable" && input.sourceUrls.length === 0) invalid("usable visual input has no provenance URLs");
for (const url of input.sourceUrls) { try { const parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol)) throw new Error("unsupported protocol"); } catch { invalid(`invalid source URL ${url}`); } }
if (input.status === "usable" && request.kind === "dataset") {
  const dataset = input.dataset;
  const usableDataset = requireDataset(dataset);
  if (usableDataset.rows.length === 0) invalid("usable dataset request has no plot-ready rows");
  const fields = new Set(usableDataset.fields.map((field) => field.key));
  for (const row of usableDataset.rows) for (const key of Object.keys(row)) if (!fields.has(key)) invalid(`dataset row uses undeclared field ${key}`);
}
if (input.status === "usable" && ["image", "screenshot"].includes(request.kind)) {
  const image = input.image;
  const usableImage = requireImage(image);
  if (!usableImage.localPath) invalid("usable image request has no localPath");
  try { await access(resolve(process.cwd(), usableImage.localPath)); } catch { invalid(`image file is missing: ${usableImage.localPath}`); }
}
if (input.status === "not-found" && !input.fallback) invalid("not-found visual input has no fallback");
finish("VISUAL_INPUT_VALID");
