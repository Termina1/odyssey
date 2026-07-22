import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ElementPackage, JsonPatch, PlanGateFeedbackOutput } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const inputPath = resolve(process.cwd(), requiredEnv("INPUT_FILE"));
const patch = process.env.PATCH_JSON
	? parseJsonText(process.env.PATCH_JSON, JsonPatch, "PATCH_JSON")
	: await parseJsonFile(requiredEnv("PATCH_FILE"), JsonPatch);
const mode = process.env.PATCH_MODE ?? "fallback";
const allowed = new RegExp(process.env.ALLOWED_PATH_PATTERN ?? "^/blocks/(?:-|[0-9]+)(?:/fallbackRequestId)?$");
const document = JSON.parse(await readFile(inputPath, "utf8")) as { blocks?: Array<Record<string, unknown>> };
for (const operation of patch) {
	if (!allowed.test(operation.path)) throw new Error(`patch path is outside bounded lane: ${operation.path}`);
	const addsFallbackBlock =
		operation.op === "add" &&
		operation.path === "/blocks/-" &&
		typeof operation.value === "object" &&
		operation.value !== null &&
		typeof (operation.value as Record<string, unknown>).fallbackRequestId === "string";
	if (mode === "fallback" && !operation.path.endsWith("/fallbackRequestId") && !addsFallbackBlock)
		throw new Error(`fallback patch cannot mutate ${operation.path}`);
	const [, collection, indexText, field] = operation.path.split("/");
	if (collection !== "blocks") throw new Error(`unsupported patch path ${operation.path}`);
	const index = indexText === "-" ? (document.blocks ?? []).length : Number(indexText);
	if (operation.op === "add" && indexText === "-") {
		if (!operation.value || typeof operation.value !== "object") throw new Error("block add requires an object");
		if (!document.blocks) document.blocks = [];
		document.blocks.push(operation.value as Record<string, unknown>);
		continue;
	}
	const block = document.blocks?.[index];
	if (!block) throw new Error(`patch references missing block ${index}`);
	if (operation.op === "remove") delete block[field];
	else block[field] = operation.value;
}
const output = ElementPackage.parse(document);
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
	JSON.stringify({
		type: "JSON_PATCH_APPLIED",
		output: PlanGateFeedbackOutput.parse({ reason: "", instructions: [] }),
	}),
);
