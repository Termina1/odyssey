const visit = Number(process.env.QA_VISIT ?? "1");
const feedback = JSON.parse(process.env.FEEDBACK_JSON ?? "{}");
const type = visit >= 2 ? "QA_LIMIT_REACHED" : "ALLOW_REWRITE";
console.log(JSON.stringify({ type, output: feedback }));
