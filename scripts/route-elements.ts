import { ChapterPlan, ElementPackage, SectionWorkItem, VisualCatalog } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";
import { checkElementPackage } from "../guards/element-checks.js";
import { errorMessage } from "../guards/runtime.js";

const finish = (
	type: "ELEMENTS_VALID" | "ELEMENTS_PATCH_REQUIRED" | "ELEMENTS_INVALID",
	reasons: string[] = [],
): never => {
	const reason = reasons.join("; ");
	const instructions = [...reasons];
	if (type === "ELEMENTS_INVALID") {
		const attempt = Number.parseInt(process.env.ATTEMPT ?? "1", 10);
		if (Number.isFinite(attempt) && attempt >= 2)
			instructions.push(
				`This is regeneration attempt ${attempt}. If a valid chart binding is impossible for a dataset, render that dataset as a table block instead; if a block cannot fit the visual budget, drop the lowest-value editorial block first.`,
			);
	}
	process.stdout.write(`${JSON.stringify({ type, output: { reason, instructions } })}\n`);
	process.exit(0);
};

let work!: ReturnType<typeof SectionWorkItem.parse>;
let elements!: ReturnType<typeof ElementPackage.parse>;
let catalog!: ReturnType<typeof VisualCatalog.parse>;
let chapterPlan: ReturnType<typeof ChapterPlan.parse> | undefined;
try {
	work = parseJsonText(process.env.WORK_JSON ?? "", SectionWorkItem, "WORK_JSON");
	[elements, catalog] = await Promise.all([
		parseJsonFile(process.env.ELEMENTS_FILE ?? "", ElementPackage),
		parseJsonFile(process.env.VISUAL_CATALOG_FILE ?? "", VisualCatalog),
	]);
	try {
		chapterPlan = await parseJsonFile(work.chapterPlanPath, ChapterPlan);
	} catch {
		chapterPlan = undefined;
	}
} catch (error) {
	finish("ELEMENTS_INVALID", [`Cannot read element inputs: ${errorMessage(error)}`]);
}
const failure = checkElementPackage(work, elements, catalog, chapterPlan);
if (failure)
	finish(failure.kind === "patch-required" ? "ELEMENTS_PATCH_REQUIRED" : "ELEMENTS_INVALID", failure.reasons);
finish("ELEMENTS_VALID");
