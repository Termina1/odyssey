import { ChapterPlan, ElementPackage, SectionWorkItem, VisualCatalog } from "../contracts/index.js";
import { parseJsonFile, parseJsonText } from "../contracts/runtime.js";
import { checkElementPackage } from "./element-checks.js";
import { accept, errorMessage, reject } from "./runtime.js";

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
	reject(`Cannot read element inputs: ${errorMessage(error)}`);
}
const failure = checkElementPackage(work, elements, catalog, chapterPlan);
if (failure) reject(failure.reasons.join("; "));
accept("ELEMENTS_VALID");
