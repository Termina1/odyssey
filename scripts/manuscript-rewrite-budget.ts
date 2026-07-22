import { PRODUCTION_CAPS, type ProductionPolish } from "../contracts/constants.js";
import { ManuscriptGateFeedback } from "../contracts/index.js";
import { parseJsonText } from "../contracts/runtime.js";

const polish = (process.env.PRODUCTION_POLISH ?? "report") as ProductionPolish;
const MAX_TARGETED_REWRITES = PRODUCTION_CAPS[polish]?.chapterRewriteCap ?? PRODUCTION_CAPS.report.chapterRewriteCap;
const visit = Number.parseInt(process.env.BUDGET_VISIT ?? "0", 10);
const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", ManuscriptGateFeedback, "FEEDBACK_JSON");
const output = {
	reason: feedback.reason,
	chapters: feedback.chapters,
	...(feedback.engineIssues ? { engineIssues: feedback.engineIssues } : {}),
};
if (Number.isFinite(visit) && visit <= MAX_TARGETED_REWRITES) console.log(JSON.stringify({ type: "RETRY", output }));
else
	console.log(
		JSON.stringify({
			type: "CONTINUE_WITH_WARNINGS",
			output: {
				...output,
				reason:
					`Manuscript rewrite budget exhausted after ${MAX_TARGETED_REWRITES} targeted passes. ${output.reason}`.trim(),
			},
		}),
	);
