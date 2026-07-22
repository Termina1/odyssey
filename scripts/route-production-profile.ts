import { PRODUCTION_CAPS, type ProductionPolish } from "../contracts/constants.js";
import { PlanGateFeedbackOutput } from "../contracts/index.js";

const polish = process.env.PRODUCTION_POLISH as ProductionPolish;
const phase = process.env.PHASE;
if (!(polish in PRODUCTION_CAPS)) {
	process.stdout.write(
		`${JSON.stringify({ type: "POLISH_INVALID", output: PlanGateFeedbackOutput.parse({ reason: "productionPolish must be draft|report|release", instructions: ["productionPolish must be draft|report|release"] }) })}\n`,
	);
	process.exit(0);
}
const type =
	phase === "manuscript"
		? polish === "draft"
			? "POLISH_DRAFT"
			: "POLISH_MANUSCRIPT"
		: polish === "draft"
			? "POLISH_DRAFT"
			: "POLISH_VISUAL";
process.stdout.write(
	`${JSON.stringify({ type, output: PlanGateFeedbackOutput.parse({ reason: "", instructions: [] }) })}\n`,
);
