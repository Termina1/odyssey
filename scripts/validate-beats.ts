import { BeatDraft, EvidenceIndex, NarrativeStrategy } from "../contracts/index.js";
import { parseJsonFile } from "../contracts/runtime.js";

const invalid = (reason: string): never => {
  console.log(JSON.stringify({ type: "BEATS_INVALID", output: { reason, instructions: [reason] } }));
  process.exit(0);
};
let draft!: ReturnType<typeof BeatDraft.parse>;
let evidence!: ReturnType<typeof EvidenceIndex.parse>;
let strategy!: ReturnType<typeof NarrativeStrategy.parse>;
try {
  [draft, evidence, strategy] = await Promise.all([
    parseJsonFile(process.env.DRAFT_FILE ?? "", BeatDraft),
    parseJsonFile(process.env.EVIDENCE_FILE ?? "", EvidenceIndex),
    parseJsonFile(process.env.STRATEGY_FILE ?? "", NarrativeStrategy),
  ]);
} catch (error) { invalid(`Cannot read authoritative beat inputs: ${error instanceof Error ? error.message : String(error)}`); }
const evidenceIds = new Set(evidence.evidence.map((entry) => entry.id));
const sectionIds = new Set(strategy.sections.map((entry) => entry.id));
const beatIds = new Set<string>();
for (const beat of draft.beats) {
  if (beatIds.has(beat.id)) invalid(`duplicate beat id ${beat.id}`);
  beatIds.add(beat.id);
  if (!sectionIds.has(beat.sectionId)) invalid(`beat ${beat.id} references unknown section ${beat.sectionId}`);
  if (!beat.takeaway.trim()) invalid(`beat ${beat.id} has empty takeaway`);
  if (beat.evidenceIds.length === 0) invalid(`beat ${beat.id} has no evidenceIds`);
  for (const evidenceId of beat.evidenceIds) if (!evidenceIds.has(evidenceId)) invalid(`beat ${beat.id} references unknown evidence ${evidenceId}`);
}
console.log(JSON.stringify({ type: "BEATS_VALID", output: { reason: "", instructions: [] } }));
