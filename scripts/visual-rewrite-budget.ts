import { ManuscriptGateFeedback } from "../contracts/index.js";
import { parseJsonText } from "../contracts/runtime.js";

const visit = Number(process.env.QA_VISIT ?? "1");
const feedback = parseJsonText(process.env.FEEDBACK_JSON ?? "{}", ManuscriptGateFeedback, "FEEDBACK_JSON");
const type = visit >= 2 ? "QA_LIMIT_REACHED" : "ALLOW_REWRITE";
console.log(JSON.stringify({ type, output: feedback }));
