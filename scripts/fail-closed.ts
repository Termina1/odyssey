import { reject } from "../guards/runtime.js";

reject(process.env.REASON ?? "Report closure failed");
