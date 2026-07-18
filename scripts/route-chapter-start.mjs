const work = JSON.parse(process.env.WORK_JSON ?? "{}");
const owner = work.reworkFeedback?.owner;
const type = owner === "copy" ? "START_COPY" : owner === "elements" ? "START_ELEMENTS" : "START_LAYOUT";
console.log(JSON.stringify({ type, output: { reason: work.reworkFeedback?.reason ?? "", instructions: work.reworkFeedback?.instructions ?? [] } }));
