import { PRODUCTION_CAPS, type ProductionPolish } from "../contracts/constants.js";
import { ManuscriptGateFeedback } from "../contracts/index.js";
import { parseJsonText } from "../contracts/runtime.js";

const polish = (process.env.PRODUCTION_POLISH ?? "report") as ProductionPolish;
const visit = Number(process.env.QA_VISIT ?? "1");
const maxPasses = PRODUCTION_CAPS[polish]?.visualQaPasses ?? PRODUCTION_CAPS.report.visualQaPasses;
const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", ManuscriptGateFeedback, "FEEDBACK_JSON");
const type = visit > maxPasses ? "QA_LIMIT_REACHED" : "ALLOW_REWRITE";
console.log(JSON.stringify({ type, output: feedback }));
