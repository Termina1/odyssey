import { SectionWorkItem } from "../contracts/index.js";
import { parseJsonText } from "../contracts/runtime.js";

const work = parseJsonText(process.env.WORK_JSON ?? "{}", SectionWorkItem, "WORK_JSON");
const owner = work.reworkFeedback?.owner;
const type = owner === "copy" ? "START_COPY" : owner === "elements" ? "START_ELEMENTS" : "START_LAYOUT";
console.log(JSON.stringify({ type, output: { reason: work.reworkFeedback?.reason ?? "", instructions: work.reworkFeedback?.instructions ?? [] } }));
