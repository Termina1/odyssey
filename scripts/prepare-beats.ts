import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BeatDraft, BeatItems, EvidenceIndex, NarrativeStrategy, type BeatWorkItem, type EvidenceIndex as EvidenceIndexType } from "../contracts/index.js";
import { parseJsonFile } from "../contracts/runtime.js";

const draft = await parseJsonFile(process.env.DRAFT_FILE ?? "", BeatDraft);
const evidence = await parseJsonFile(process.env.EVIDENCE_FILE ?? "", EvidenceIndex);
const strategy = await parseJsonFile(process.env.STRATEGY_FILE ?? "", NarrativeStrategy);
const outputPath = resolve(process.cwd(), process.env.OUTPUT_PATH ?? "artifacts/plan/beat-items.json");
const packetDir = resolve(process.cwd(), process.env.PACKET_DIR ?? "artifacts/plan/beat-packets");
const safeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
const evidenceById = new Map(evidence.evidence.map((entry) => [entry.id, entry]));
const sourcesById = new Map(evidence.sources.map((entry) => [entry.id, entry]));
const sectionIds = new Set(strategy.sections.map((section) => section.id));
const items: Record<string, BeatWorkItem> = {};
await mkdir(packetDir, { recursive: true });
for (let index = 0; index < draft.beats.length; index += 1) {
  const beat = draft.beats[index];
  if (!beat) continue;
  if (!sectionIds.has(beat.sectionId)) throw new Error(`beat ${beat.id} references unknown section ${beat.sectionId}`);
  const key = safeKey(beat.id);
  if (!key || items[key]) throw new Error(`invalid or duplicate beat map key: ${beat.id}`);
  const selectedEvidence = beat.evidenceIds.map((id) => {
    const entry = evidenceById.get(id);
    if (!entry) throw new Error(`beat ${beat.id} references unknown evidence ${id}`);
    return entry;
  });
  const sourceIds = [...new Set(selectedEvidence.flatMap((entry) => entry.sourceIds))];
  const packetPath = resolve(packetDir, `${key}.json`);
  const workItem: BeatWorkItem = { ...beat, index, packetPath };
  const packet = { beat: workItem, evidence: selectedEvidence, sources: sourceIds.map((id) => sourcesById.get(id)).filter((source): source is EvidenceIndexType["sources"][number] => Boolean(source)) };
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`);
  items[key] = workItem;
}
const output = BeatItems.parse({ items, count: Object.keys(items).length, artifactPath: process.env.OUTPUT_PATH ?? "artifacts/plan/beat-items.json" });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "BEAT_ITEMS_READY", output }));
