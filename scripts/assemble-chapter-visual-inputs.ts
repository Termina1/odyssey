import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { VisualCatalog, VisualInput } from "../contracts/index.js";
import { parseJsonFile, parseJsonText, requiredEnv } from "../contracts/runtime.js";

const files = parseJsonText(process.env.VISUAL_FILES ?? "[]", z.array(z.string()), "VISUAL_FILES");
const inputs: Array<z.infer<typeof VisualInput>> = [];
for (const path of files) inputs.push(await parseJsonFile(path, VisualInput));
const output = VisualCatalog.parse({ sectionId: requiredEnv("SECTION_ID"), inputs });
const outputPath = resolve(process.cwd(), requiredEnv("OUTPUT_PATH"));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ type: "VISUAL_INPUTS_READY", output: { reason: "", instructions: [] } }));
