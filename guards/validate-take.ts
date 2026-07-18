import { resolve, sep } from "node:path";
import { DeepResearch, TakeManifest } from "../contracts/index.js";
import { parseJsonText, parseJsonFile } from "../contracts/runtime.js";

const fail = (reason: string): never => { process.stderr.write(`${reason}\n`); process.exit(1); };
const stdin = await new Promise<string>((resolveInput) => { let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk: string) => { value += chunk; }); process.stdin.on("end", () => resolveInput(value)); });
let manifest!: ReturnType<typeof TakeManifest.parse>;
try { manifest = parseJsonText(stdin, TakeManifest, "completion event"); } catch (error) { fail(`take guard: ${error instanceof Error ? error.message : String(error)}`); }
const cwd = resolve(process.cwd());
const artifactPath = resolve(cwd, manifest.artifactPath);
if (artifactPath !== cwd && !artifactPath.startsWith(`${cwd}${sep}`)) fail("take guard: artifactPath escapes run directory");
let research!: ReturnType<typeof DeepResearch.parse>;
try { research = await parseJsonFile(artifactPath, DeepResearch); } catch (error) { fail(`take guard: cannot read artifact: ${error instanceof Error ? error.message : String(error)}`); }
if (research.takeId !== manifest.takeId) fail(`take guard: takeId mismatch (${research.takeId} != ${manifest.takeId})`);
const sourceIds = new Set<string>();
for (const source of research.sources) { if (sourceIds.has(source.id)) fail(`take guard: duplicate source id ${source.id}`); sourceIds.add(source.id); try { const url = new URL(source.url); if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol"); } catch { fail(`take guard: invalid source URL for ${source.id}`); } }
const findingIds = new Set<string>();
for (const finding of research.findings) { if (findingIds.has(finding.id)) fail(`take guard: duplicate finding id ${finding.id}`); findingIds.add(finding.id); if (!finding.claim.trim()) fail("take guard: empty finding claim"); if (finding.sourceIds.length === 0) fail("take guard: finding without sourceIds"); for (const sourceId of finding.sourceIds) if (!sourceIds.has(sourceId)) fail(`take guard: finding references unknown source ${sourceId}`); }
for (const criterion of research.acceptanceCriteria) { if (!criterion.criterion.trim()) fail("take guard: empty acceptance criterion"); for (const evidenceId of criterion.evidenceIds) if (!findingIds.has(evidenceId)) fail(`take guard: criterion references unknown evidence ${evidenceId}`); }
if (manifest.sourceCount !== research.sources.length) fail("take guard: sourceCount does not match artifact");
if (manifest.evidenceCount !== research.findings.length) fail("take guard: evidenceCount does not match artifact");
