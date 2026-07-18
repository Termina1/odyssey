const MAX_TARGETED_REWRITES = 2;
const visit = Number.parseInt(process.env.BUDGET_VISIT ?? "0", 10);
const feedback = JSON.parse(process.env.FEEDBACK_JSON ?? "{}");
const output = {
	reason: typeof feedback.reason === "string" ? feedback.reason : "",
	chapters: feedback.chapters && typeof feedback.chapters === "object" ? feedback.chapters : {},
	...(Array.isArray(feedback.engineIssues) ? { engineIssues: feedback.engineIssues } : {}),
};

if (Number.isFinite(visit) && visit <= MAX_TARGETED_REWRITES) {
	console.log(JSON.stringify({ type: "RETRY", output }));
} else {
	console.log(JSON.stringify({
		type: "CONTINUE_WITH_WARNINGS",
		output: {
			...output,
			reason: `Manuscript rewrite budget exhausted after ${MAX_TARGETED_REWRITES} targeted passes. ${output.reason}`.trim(),
		},
	}));
}
