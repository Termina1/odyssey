import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const finish = (type, reason = "") => console.log(JSON.stringify({ type, output: { reason, instructions: reason ? [reason] : [] } }));
const invalid = (reason) => { finish("VISUAL_INPUT_INVALID", reason); process.exit(0); };
let request, input, evidence;
try {
  request = JSON.parse(process.env.REQUEST_JSON);
  [input, evidence] = await Promise.all([
    readFile(resolve(process.cwd(), process.env.INPUT_FILE), "utf8").then(JSON.parse),
    readFile(resolve(process.cwd(), process.env.EVIDENCE_FILE), "utf8").then(JSON.parse),
  ]);
}
catch (error) { invalid(`Cannot read visual input: ${error instanceof Error ? error.message : String(error)}`); }
if (input.requestId !== request.id) invalid(`requestId mismatch for ${request.id}`);
if (input.kind !== request.kind) invalid(`kind mismatch for ${request.id}`);
if (!Array.isArray(input.sourceUrls) || !Array.isArray(input.sourceIds) || !Array.isArray(input.limitations)) invalid("visual input provenance arrays are missing");
const requestedEvidence = new Set(request.evidenceIds ?? []);
const allowedSourceIds = new Set((evidence.evidence ?? []).filter((entry) => requestedEvidence.has(entry.id)).flatMap((entry) => entry.sourceIds ?? []));
for (const sourceId of input.sourceIds) {
  if (typeof sourceId === "string" && sourceId.startsWith("e_")) {
    invalid(`sourceIds contains evidence ID ${sourceId}; use only source-record IDs with the s_ prefix, and put evidence IDs in dataset.provenance[].evidenceId`);
  }
  if (!allowedSourceIds.has(sourceId)) invalid(`visual input references unrelated source record ${sourceId}`);
}
for (const entry of input.dataset?.provenance ?? []) {
  if (entry.evidenceId !== undefined && !requestedEvidence.has(entry.evidenceId)) invalid(`dataset provenance references unrelated evidence ${entry.evidenceId}`);
}
if (input.status === "usable" && input.sourceUrls.length === 0) invalid("usable visual input has no provenance URLs");
for (const url of input.sourceUrls) { try { const parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { invalid(`invalid source URL ${url}`); } }
if (input.status === "usable" && request.kind === "dataset") {
  if (!input.dataset || !Array.isArray(input.dataset.fields) || !Array.isArray(input.dataset.rows) || input.dataset.rows.length === 0) invalid("usable dataset request has no plot-ready rows");
  const fields = new Set(input.dataset.fields.map((field) => field.key));
  for (const row of input.dataset.rows) for (const key of Object.keys(row)) if (!fields.has(key)) invalid(`dataset row uses undeclared field ${key}`);
}
if (input.status === "usable" && ["image", "screenshot"].includes(request.kind)) {
  if (!input.image?.localPath) invalid("usable image request has no localPath");
  try { await access(resolve(process.cwd(), input.image.localPath)); } catch { invalid(`image file is missing: ${input.image.localPath}`); }
}
if (input.status === "not-found" && !input.fallback) invalid("not-found visual input has no fallback");
finish("VISUAL_INPUT_VALID");
