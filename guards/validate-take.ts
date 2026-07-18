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
if (manifest.sourceCount !== research.sources.length) fail("take guard: sourceCount does not match artifact");
if (manifest.evidenceCount !== research.findings.length) fail("take guard: evidenceCount does not match artifact");
