import { contract, z } from "@surprisal/hyperchart";

export const HttpUrl = z
	.string()
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}, "URL must use http or https");
const NonEmptyText = z.string().refine((value) => value.trim().length > 0, "Must not be blank");

export const SourceRecord = z.object({
	id: z.string(),
	title: z.string(),
	url: HttpUrl,
	publisher: z.string(),
	date: z.string().optional(),
	sourceType: z.string(),
});

export const InitialResearch = z.object({
	angleId: z.string(),
	angleTitle: z.string(),
	bottomLine: z.array(z.string()),
	findings: z.array(
		z.object({
			claim: z.string(),
			sourceIds: z.array(z.string()),
			confidence: z.enum(["high", "medium", "low"]),
		}),
	),
	sources: z.array(SourceRecord),
	contradictions: z.array(z.string()),
	gaps: z.array(z.string()),
	suggestedDeepQuestions: z.array(z.string()),
});

const narrativeSkeletonSchema = () =>
	z.object({
		thesis: NonEmptyText,
		readerQuestion: NonEmptyText,
		beats: z.array(
			z.object({
				id: z.string(),
				label: NonEmptyText,
				purpose: NonEmptyText,
				evidenceNeed: z.array(z.string()),
				coverageTags: z.array(z.string()).min(1),
			}),
		),
		coverageTags: z.array(z.string()).min(1),
	});
export const NarrativeSkeleton = contract("odyssey.narrative-skeleton", "1", narrativeSkeletonSchema());

export const DeepResearchTake = z.object({
	id: z.string(),
	title: z.string(),
	question: z.string(),
	rationale: z.string(),
	priority: z.enum(["high", "medium", "low"]),
	queries: z.array(z.string()),
	preferredSourceTypes: z.array(z.string()),
	acceptanceCriteria: z.array(z.string()),
	coverageTags: z.array(z.string()).min(1),
	depthBudget: z.number().int().positive().max(48),
	stopRule: NonEmptyText,
});

const deepResearchAgendaSchema = () =>
	z.object({ takes: z.record(z.string(), DeepResearchTake), stopRule: NonEmptyText });
export const DeepResearchAgenda = contract("odyssey.deep-research-agenda", "1", deepResearchAgendaSchema());

export const GateFeedback = z.object({
	reason: z.string(),
	missingEvidence: z.array(z.string()),
	followupQueries: z.array(z.string()),
	preserveFindings: z.array(z.string()),
});

export const DeepResearch = contract(
	"odyssey.deep-research",
	"1",
	z
		.object({
			takeId: z.string(),
			answer: z.string(),
			findings: z.array(
				z.object({
					id: z.string(),
					claim: NonEmptyText,
					sourceIds: z.array(z.string()).min(1),
					confidence: z.enum(["high", "medium", "low"]),
					caveat: z.string().optional(),
					tags: z.array(z.string()).default([]),
				}),
			),
			sources: z.array(SourceRecord),
			contradictions: z.array(z.string()),
			gaps: z.array(z.string()),
			blockers: z
				.array(
					z.object({
						id: z.string(),
						description: NonEmptyText,
						severity: z.enum(["high", "medium", "low"]).default("high"),
						status: z.enum(["unresolved", "resolved", "downgraded", "removed"]).default("unresolved"),
						dependsOn: z.array(z.string()).default([]),
						rationale: z.string().default(""),
						evidenceIds: z.array(z.string()).default([]),
					}),
				)
				.default([]),
			acceptanceCriteria: z.array(
				z.object({
					criterion: NonEmptyText,
					satisfied: z.boolean(),
					evidenceIds: z.array(z.string()),
				}),
			),
		})
		.superRefine((research, context) => {
			const sourceIds = new Set<string>();
			for (const [index, source] of research.sources.entries()) {
				if (sourceIds.has(source.id))
					context.addIssue({
						code: "custom",
						path: ["sources", index, "id"],
						message: `Duplicate source id ${source.id}`,
					});
				sourceIds.add(source.id);
			}
			const findingIds = new Set<string>();
			for (const [index, finding] of research.findings.entries()) {
				if (findingIds.has(finding.id))
					context.addIssue({
						code: "custom",
						path: ["findings", index, "id"],
						message: `Duplicate finding id ${finding.id}`,
					});
				findingIds.add(finding.id);
				for (const [sourceIndex, sourceId] of finding.sourceIds.entries())
					if (!sourceIds.has(sourceId))
						context.addIssue({
							code: "custom",
							path: ["findings", index, "sourceIds", sourceIndex],
							message: `Unknown source id ${sourceId}`,
						});
			}
			for (const [criterionIndex, criterion] of research.acceptanceCriteria.entries()) {
				for (const [evidenceIndex, evidenceId] of criterion.evidenceIds.entries())
					if (!findingIds.has(evidenceId))
						context.addIssue({
							code: "custom",
							path: ["acceptanceCriteria", criterionIndex, "evidenceIds", evidenceIndex],
							message: `Unknown evidence id ${evidenceId}`,
						});
			}
		}),
);

export const EvidenceSource = SourceRecord;
export const EvidenceItem = z.object({
	id: z.string(),
	claim: z.string(),
	sourceIds: z.array(z.string()),
	confidence: z.enum(["high", "medium", "low"]),
	caveat: z.string(),
	tags: z.array(z.string()),
	takeIds: z.array(z.string()),
});

export const TakeManifest = z.object({
	takeId: z.string(),
	artifactPath: z.string(),
	sourceCount: z.number().int().nonnegative(),
	evidenceCount: z.number().int().nonnegative(),
});

const RegisterStatus = z.enum(["unresolved", "resolved", "downgraded", "removed"]);
const ContradictionEntry = z.object({
	id: z.string(),
	description: NonEmptyText,
	takeIds: z.array(z.string()),
	status: RegisterStatus.default("unresolved"),
	rationale: z.string().default(""),
	evidenceIds: z.array(z.string()).default([]),
});
const BlockerEntry = z.object({
	id: z.string(),
	description: NonEmptyText,
	severity: z.enum(["high", "medium", "low"]),
	status: RegisterStatus,
	dependsOn: z.array(z.string()),
	rationale: z.string(),
	evidenceIds: z.array(z.string()),
	takeIds: z.array(z.string()),
});

const evidenceIndexSchema = () =>
	z.object({
		evidence: z.array(EvidenceItem),
		sources: z.array(EvidenceSource),
		contradictions: z.array(ContradictionEntry),
		gaps: z.array(z.object({ description: z.string(), takeIds: z.array(z.string()) })),
		blockers: z.array(BlockerEntry).default([]),
		counts: z.object({
			takes: z.number().int().nonnegative(),
			evidence: z.number().int().nonnegative(),
			sources: z.number().int().nonnegative(),
		}),
	});
export const EvidenceIndex = contract("odyssey.evidence-index", "1", evidenceIndexSchema());

export const EvidenceManifest = z.object({
	artifactPath: z.string(),
	takes: z.number().int().nonnegative(),
	evidence: z.number().int().nonnegative(),
	sources: z.number().int().nonnegative(),
});

export const StrategySection = z.object({
	id: z.string(),
	title: z.string(),
	purpose: z.string(),
	evidenceIds: z.array(z.string()),
});

export const NarrativeStrategy = contract(
	"odyssey.narrative-strategy",
	"1",
	z
		.object({
			title: z.string(),
			objective: z.string(),
			thesis: NonEmptyText,
			readerQuestion: NonEmptyText,
			sections: z.array(StrategySection).min(1),
			exclusions: z.array(z.string()),
			styleNotes: z.array(z.string()),
		})
		.superRefine((strategy, context) => {
			const sectionIds = new Set<string>();
			for (const [index, section] of strategy.sections.entries()) {
				if (sectionIds.has(section.id))
					context.addIssue({
						code: "custom",
						path: ["sections", index, "id"],
						message: `Duplicate strategy section id ${section.id}`,
					});
				sectionIds.add(section.id);
				if (section.evidenceIds.length === 0)
					context.addIssue({
						code: "custom",
						path: ["sections", index, "evidenceIds"],
						message: "Strategy section must allocate evidence",
					});
			}
		}),
);

export const Beat = z.object({
	id: z.string(),
	sectionId: z.string(),
	narrativePurpose: z.string(),
	takeaway: z.string(),
	evidenceIds: z.array(z.string()),
	dependsOnBeatIds: z.array(z.string()).default([]),
	caveat: z.string().optional(),
});

const beatDraftSchema = () =>
	z.object({ beats: z.array(Beat) }).superRefine((draft, context) => {
		const beatIds = new Set<string>();
		for (const [index, beat] of draft.beats.entries()) {
			if (beatIds.has(beat.id))
				context.addIssue({
					code: "custom",
					path: ["beats", index, "id"],
					message: `Duplicate beat id ${beat.id}`,
				});
			beatIds.add(beat.id);
			if (beat.takeaway.trim().length === 0)
				context.addIssue({
					code: "custom",
					path: ["beats", index, "takeaway"],
					message: "Beat takeaway must not be blank",
				});
			if (beat.evidenceIds.length === 0)
				context.addIssue({
					code: "custom",
					path: ["beats", index, "evidenceIds"],
					message: "Beat must reference evidence",
				});
		}
	});
export const BeatDraft = contract("odyssey.beat-draft", "1", beatDraftSchema());

export const BeatWorkItem = Beat.extend({
	index: z.number().int().nonnegative(),
	packetPath: z.string(),
});

export const BeatItems = z.object({
	items: z.record(z.string(), BeatWorkItem),
	count: z.number().int().nonnegative(),
	artifactPath: z.string(),
});
export const BeatPatch = z.object({
	beatId: z.string(),
	operations: z
		.array(z.object({ op: z.literal("replace"), path: z.literal("/evidenceIds"), value: z.array(z.string()).min(1) }))
		.min(1)
		.max(4),
});
export const BeatPacket = z.object({
	request: z.string(),
	beat: BeatWorkItem,
	evidence: z.array(EvidenceItem),
	sources: z.array(SourceRecord),
});

export const VerifiedBeat = contract(
	"odyssey.verified-beat",
	"1",
	z
		.object({
			id: z.string(),
			index: z.number().int().nonnegative(),
			sectionId: z.string(),
			narrativePurpose: z.string(),
			verdict: z.enum(["supported", "weakened", "unsupported"]),
			takeaway: z.string(),
			evidenceIds: z.array(z.string()),
			confidence: z.number().min(0).max(1),
			caveat: z.string(),
			notes: z.array(z.string()),
			dependsOnBeatIds: z.array(z.string()).default([]),
		})
		.superRefine((beat, context) => {
			if (beat.verdict !== "unsupported" && beat.evidenceIds.length === 0)
				context.addIssue({
					code: "custom",
					path: ["evidenceIds"],
					message: "Supported or weakened verification must reference evidence",
				});
		}),
);

const beatVerdictSchema = () =>
	z
		.object({
			id: z.string(),
			verdict: z.enum(["supported", "weakened", "unsupported"]),
			evidenceIds: z.array(z.string()),
			confidence: z.number().min(0).max(1),
			caveat: z.string(),
			notes: z.array(z.string()),
		})
		.superRefine((verdict, context) => {
			if (verdict.verdict !== "unsupported" && verdict.evidenceIds.length === 0)
				context.addIssue({
					code: "custom",
					path: ["evidenceIds"],
					message: "Supported or weakened verification must reference evidence",
				});
		});
export const BeatVerdict = contract("odyssey.beat-verdict", "1", beatVerdictSchema());

export const ReportPlan = z.object({
	title: z.string(),
	objective: z.string(),
	thesis: z.string(),
	readerQuestion: z.string(),
	sections: z.array(StrategySection.extend({ beatIds: z.array(z.string()) })),
	beats: z.array(VerifiedBeat),
	exclusions: z.array(z.string()),
	styleNotes: z.array(z.string()),
	blockers: z.array(z.record(z.string(), z.unknown())).default([]),
	contradictions: z.array(z.record(z.string(), z.unknown())).default([]),
	unsupportedBeatIds: z.array(z.string()).default([]),
	beatDependencies: z.record(z.string(), z.array(z.string())).default({}),
});

export const ClosureReview = z.object({
	reason: z.string(),
	blockers: z.array(z.record(z.string(), z.unknown())).default([]),
	instructions: z.array(z.string()).default([]),
});

export const PlanManifest = z.object({
	artifactPath: z.string(),
	sectionCount: z.number().int().nonnegative(),
	beatCount: z.number().int().nonnegative(),
});

export const PlanGateFeedback = z.object({
	reason: z.string(),
	instructions: z.array(z.string()),
});

export const SectionBeatWorkItem = z.object({
	sectionId: z.string(),
	section: StrategySection,
	currentBeats: z.array(Beat),
	evidence: z.array(EvidenceItem),
	feedback: PlanGateFeedback,
	mode: z.enum(["initial", "repair"]),
	allSections: z.array(z.object({ id: z.string(), title: z.string(), purpose: z.string() })),
	allBeats: z.array(z.object({ id: z.string(), sectionId: z.string(), takeaway: z.string() })),
});

export const SectionBeatWorkItems = z.object({
	items: z.record(z.string(), SectionBeatWorkItem),
	count: z.number().int().nonnegative(),
	artifactPath: z.string(),
});

const sectionBeatDraftSchema = () =>
	z.object({ sectionId: z.string(), beats: z.array(Beat).min(1) }).superRefine((draft, context) => {
		const ids = new Set<string>();
		for (const [index, beat] of draft.beats.entries()) {
			if (beat.sectionId !== draft.sectionId)
				context.addIssue({
					code: "custom",
					path: ["beats", index, "sectionId"],
					message: `Beat ${beat.id} belongs to ${beat.sectionId}, expected ${draft.sectionId}`,
				});
			if (ids.has(beat.id))
				context.addIssue({
					code: "custom",
					path: ["beats", index, "id"],
					message: `Duplicate section beat id ${beat.id}`,
				});
			ids.add(beat.id);
		}
	});
export const SectionBeatDraft = contract("odyssey.section-beat-draft", "1", sectionBeatDraftSchema());

export const ChartVariant = z.enum([
	"line",
	"area",
	"bar",
	"stacked-bar",
	"grouped-bar",
	"100%-stacked-bar",
	"scatter",
	"bubble",
	"heatmap",
	"treemap",
	"sunburst",
	"sankey",
]);
export const VisualOutput = z.enum([
	...ChartVariant.options,
	"table",
	"metric-strip",
	"photo",
	"product-screenshot",
	"map",
]);

export const VisualRequest = z.object({
	id: z.string(),
	sectionId: z.string(),
	beatId: z.string(),
	kind: z.enum(["dataset", "image", "screenshot", "map-data"]),
	purpose: z.string(),
	question: z.string(),
	evidenceIds: z.array(z.string()),
	preferredOutput: VisualOutput,
	requirements: z.array(z.string()),
	fallback: z.enum(["diagram", "callout", "prose"]),
	intent: z.enum(["dataset-backed", "inline"]),
	required: z.boolean(),
});

export const ExperienceBeat = z.object({
	beatId: z.string(),
	presentation: z.enum(["prose", "anchor", "supporting"]),
	visualIntent: z.enum(["none", "data", "image", "diagram", "map"]),
	preferredOutputs: z.array(VisualOutput),
});

export const ExperienceSection = z.object({
	sectionId: z.string(),
	layout: z.enum(["essay", "split", "visual-led", "comparison-led"]),
	openingMode: z.enum(["claim", "question", "metric", "scene"]),
	openingClaim: z.string(),
	handoff: z.string(),
	visualBudget: z.number().int().nonnegative().max(6),
	beats: z.record(z.string(), ExperienceBeat),
});

export const ExperiencePlan = z.object({
	direction: z.string(),
	density: z.enum(["airy", "balanced", "dense"]),
	globalRules: z.object({
		maxBlocksPerBeat: z.number().int().min(0).max(2),
		maxBlocksPerSection: z.number().int().min(0).max(6),
		avoidRepeatedTypes: z.boolean(),
		progressiveEvidenceDisclosure: z.boolean(),
	}),
	sections: z.record(z.string(), ExperienceSection),
});

export const ChapterPlan = z.object({
	sectionId: z.string(),
	layout: z.enum(["essay", "split", "visual-led", "comparison-led"]),
	openingClaim: z.string(),
	handoff: z.string(),
	elementIntents: z.record(
		z.string(),
		z.object({
			beatId: z.string(),
			mode: z.enum(["inline", "dataset-backed"]),
			output: VisualOutput,
			guaranteedUse: z.boolean(),
		}),
	),
	visualRequests: z.record(z.string(), VisualRequest),
});

export const DatasetField = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum(["category", "number", "date", "boolean"]),
	unit: z.string().optional(),
});
export const Dataset = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	fields: z.array(DatasetField),
	rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
	provenance: z.array(
		z.object({ sourceUrl: z.string(), evidenceId: z.string().optional(), extractionNote: z.string() }),
	),
	limitations: z.array(z.string()),
});
export const ImageAsset = z.object({
	localPath: z.string(),
	sourceUrl: z.string(),
	sourcePageUrl: z.string(),
	attribution: z.string(),
	license: z.string(),
	mimeType: z.string(),
	alt: z.string(),
	caption: z.string(),
});
export const VisualInput = contract(
	"odyssey.visual-input",
	"1",
	z
		.object({
			requestId: z.string(),
			kind: z.enum(["dataset", "image", "screenshot", "map-data"]),
			status: z.enum(["usable", "not-found"]),
			sourceIds: z.array(z.string()),
			sourceUrls: z.array(HttpUrl),
			dataset: Dataset.optional(),
			image: ImageAsset.optional(),
			limitations: z.array(z.string()),
			fallback: z.enum(["diagram", "callout", "prose"]).optional(),
		})
		.superRefine((input, context) => {
			for (const [index, sourceId] of input.sourceIds.entries())
				if (!sourceId.startsWith("s_"))
					context.addIssue({
						code: "custom",
						path: ["sourceIds", index],
						message: "Visual source IDs must use the s_ source-record prefix",
					});
			if (input.status === "not-found") {
				if (input.fallback === undefined)
					context.addIssue({
						code: "custom",
						path: ["fallback"],
						message: "Not-found visual input requires a fallback",
					});
				return;
			}
			if (input.sourceUrls.length === 0)
				context.addIssue({
					code: "custom",
					path: ["sourceUrls"],
					message: "Usable visual input requires provenance URLs",
				});
			if (input.kind === "dataset" || input.kind === "map-data") {
				if (input.dataset === undefined || input.dataset.rows.length === 0) {
					context.addIssue({
						code: "custom",
						path: ["dataset", "rows"],
						message: "Usable data visual input requires plot-ready rows",
					});
				} else {
					const fields = new Set(input.dataset.fields.map((field) => field.key));
					for (const [rowIndex, row] of input.dataset.rows.entries())
						for (const key of Object.keys(row))
							if (!fields.has(key))
								context.addIssue({
									code: "custom",
									path: ["dataset", "rows", rowIndex, key],
									message: `Dataset row uses undeclared field ${key}`,
								});
				}
			}
			if ((input.kind === "image" || input.kind === "screenshot") && !input.image?.localPath.trim())
				context.addIssue({
					code: "custom",
					path: ["image", "localPath"],
					message: "Usable image visual input requires a localPath",
				});
		}),
);

export const VisualCatalog = z.object({
	sectionId: z.string(),
	inputs: z.array(VisualInput),
});

export const VisualPacket = z.object({
	request: VisualRequest,
	evidence: z.array(EvidenceItem),
	sources: z.array(SourceRecord),
});
export const VisualWorkItem = VisualRequest.extend({ packetPath: z.string() });
export const VisualWorkItems = z.object({
	items: z.record(z.string(), VisualWorkItem),
	count: z.number().int().nonnegative(),
});

export const JsonPatch = z
	.array(z.object({ op: z.enum(["add", "replace", "remove"]), path: z.string(), value: z.unknown().optional() }))
	.max(12);
export const EvidenceRegisterPatch = z
	.array(
		z.object({
			id: z.string(),
			description: NonEmptyText,
			status: z.enum(["resolved", "downgraded"]),
			rationale: NonEmptyText,
			evidenceIds: z.array(z.string()).min(1),
		}),
	)
	.max(8);

export const BlockBase = z.object({
	id: z.string(),
	beatId: z.string(),
	title: z.string(),
	purpose: z.string(),
	evidenceIds: z.array(z.string()),
	fallbackRequestId: z.string().optional(),
});
export const RichBlock = z.discriminatedUnion("type", [
	BlockBase.extend({
		type: z.literal("chart"),
		datasetRequestId: z.string(),
		variant: ChartVariant,
		encoding: z.record(z.string(), z.string()),
		annotations: z.array(
			z.object({
				label: z.string(),
				x: z.union([z.string(), z.number()]).optional(),
				y: z.union([z.string(), z.number()]).optional(),
			}),
		),
		interaction: z.object({ tooltip: z.boolean(), zoom: z.boolean(), legendFilter: z.boolean() }),
		forecast: z.object({ field: z.string() }).optional(),
	}),
	BlockBase.extend({
		type: z.literal("metric-strip"),
		datasetRequestId: z.string(),
		metrics: z
			.array(
				z.object({
					label: z.string(),
					valueField: z.string(),
					where: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
				}),
			)
			.min(1),
	}),
	BlockBase.extend({ type: z.literal("table"), datasetRequestId: z.string(), columns: z.array(z.string()) }),
	BlockBase.extend({
		type: z.literal("comparison"),
		columns: z.array(z.object({ title: z.string(), body: z.string() })),
	}),
	BlockBase.extend({
		type: z.literal("timeline"),
		items: z.array(z.object({ label: z.string(), body: z.string() })).min(2),
	}),
	BlockBase.extend({
		type: z.literal("flow"),
		steps: z.array(z.object({ label: z.string(), body: z.string() })).min(2),
	}),
	BlockBase.extend({
		type: z.literal("matrix"),
		cells: z.array(z.object({ x: z.string(), y: z.string(), title: z.string(), body: z.string() })).min(4),
		annotations: z.array(z.string()).optional(),
	}),
	BlockBase.extend({
		type: z.literal("callout"),
		tone: z.enum(["insight", "warning", "decision", "scope"]),
		body: z.string(),
		bullets: z.array(z.string()),
	}),
	BlockBase.extend({ type: z.literal("quote"), quote: z.string(), attribution: z.string() }),
	BlockBase.extend({ type: z.literal("image"), imageRequestId: z.string(), alt: z.string(), caption: z.string() }),
]);
export const allowedChartEncodings: ReadonlySet<string> = new Set([
	"x",
	"y",
	"value",
	"series",
	"color",
	"size",
	"name",
	"source",
	"target",
	"forecast",
]);
export const requiredChartEncodings: Record<z.infer<typeof ChartVariant>, readonly string[]> = {
	line: ["x", "y"],
	area: ["x", "y"],
	bar: ["x", "y"],
	"stacked-bar": ["x", "y"],
	"grouped-bar": ["x", "y"],
	"100%-stacked-bar": ["x", "y"],
	scatter: ["x", "y"],
	bubble: ["x", "y"],
	heatmap: ["x", "y", "value"],
	treemap: [],
	sunburst: [],
	sankey: ["source", "target", "value"],
};
export const chartFamily: Record<
	z.infer<typeof ChartVariant>,
	"cartesian" | "scatter" | "heatmap" | "hierarchy" | "sankey"
> = {
	line: "cartesian",
	area: "cartesian",
	bar: "cartesian",
	"stacked-bar": "cartesian",
	"grouped-bar": "cartesian",
	"100%-stacked-bar": "cartesian",
	scatter: "scatter",
	bubble: "scatter",
	heatmap: "heatmap",
	treemap: "hierarchy",
	sunburst: "hierarchy",
	sankey: "sankey",
};

export const ElementPackage = contract(
	"odyssey.element-package",
	"1",
	z.object({ sectionId: z.string(), blocks: z.array(RichBlock) }).superRefine((elements, context) => {
		const blockIds = new Set<string>();
		for (const [index, block] of elements.blocks.entries()) {
			if (block.id.trim().length === 0)
				context.addIssue({ code: "custom", path: ["blocks", index, "id"], message: "Block id must not be blank" });
			if (blockIds.has(block.id))
				context.addIssue({
					code: "custom",
					path: ["blocks", index, "id"],
					message: `Duplicate block id ${block.id}`,
				});
			blockIds.add(block.id);
			if (block.type !== "chart") continue;
			for (const channel of Object.keys(block.encoding))
				if (!allowedChartEncodings.has(channel))
					context.addIssue({
						code: "custom",
						path: ["blocks", index, "encoding", channel],
						message: `Unsupported chart encoding channel ${channel}`,
					});
			for (const channel of requiredChartEncodings[block.variant])
				if (typeof block.encoding[channel] !== "string")
					context.addIssue({
						code: "custom",
						path: ["blocks", index, "encoding", channel],
						message: `Chart variant ${block.variant} requires encoding.${channel}`,
					});
			if (block.variant === "treemap" || block.variant === "sunburst") {
				if (typeof (block.encoding.value ?? block.encoding.y) !== "string")
					context.addIssue({
						code: "custom",
						path: ["blocks", index, "encoding"],
						message: `Chart variant ${block.variant} requires encoding.value or encoding.y`,
					});
				if (typeof (block.encoding.name ?? block.encoding.x) !== "string")
					context.addIssue({
						code: "custom",
						path: ["blocks", index, "encoding"],
						message: `Chart variant ${block.variant} requires encoding.name or encoding.x`,
					});
			}
		}
	}),
);

export const SectionModule = z.object({
	beatId: z.string(),
	headline: z.string(),
	body: z.string(),
	presentation: z.enum(["prose", "anchor", "supporting"]),
	layout: z.enum(["prose", "split", "visual-first", "compact"]),
	blockIds: z.array(z.string()),
	evidenceIds: z.array(z.string()),
	caveat: z.string().optional(),
});
export const SectionPackage = z.object({
	sectionId: z.string(),
	title: z.string(),
	dek: z.string(),
	openingClaim: z.string(),
	modules: z.array(SectionModule),
	handoff: z.string(),
});
export const ChapterReworkFeedback = z.object({
	owner: z.enum(["layout", "copy", "elements"]),
	reason: z.string(),
	instructions: z.array(z.string()),
});
export const SectionWorkItem = z.object({
	sectionId: z.string(),
	index: z.number().int().nonnegative(),
	section: StrategySection.extend({ beatIds: z.array(z.string()) }),
	beats: z.array(VerifiedBeat),
	evidence: z.array(EvidenceItem).default([]),
	sources: z.array(SourceRecord).default([]),
	experience: ExperienceSection,
	maxBlocks: z.number().int().nonnegative().default(6),
	chapterPlanPath: z.string(),
	visualCatalogPath: z.string(),
	elementPath: z.string(),
	chapterPath: z.string(),
	reworkFeedback: ChapterReworkFeedback.optional(),
});
export const SectionWorkItems = z.object({
	items: z.record(z.string(), SectionWorkItem),
	count: z.number().int().nonnegative(),
});
export const ManuscriptGateFeedback = z.object({
	reason: z.string(),
	chapters: z.record(
		z.string(),
		z.object({ owner: z.enum(["layout", "copy", "elements"]), instructions: z.array(z.string()) }),
	),
	engineIssues: z.array(z.string()).optional(),
});
export const ReportDocument = z.looseObject({
	version: z.literal("1"),
	meta: z.record(z.string(), z.unknown()),
	plan: ReportPlan,
	experience: ExperiencePlan,
	sections: z.array(SectionPackage),
	elements: z.array(ElementPackage),
	evidence: EvidenceIndex,
	visualInputs: z.array(VisualInput),
});
export const DocumentManifest = z.object({
	artifactPath: z.string(),
	sections: z.number().int().nonnegative(),
	blocks: z.number().int().nonnegative(),
});
export const RenderManifest = z.object({
	artifactPath: z.string(),
	bytes: z.number().int().positive(),
	charts: z.number().int().nonnegative(),
});
export const RenderReview = z.object({
	pass: z.boolean(),
	findings: z.array(z.object({ severity: z.string(), message: z.string() })),
});
export const RenderValidation = z.object({
	artifactPath: z.string(),
	pass: z.boolean(),
	findings: z.number().int().nonnegative(),
});
export const ScreenshotTile = z.object({
	sectionId: z.string(),
	viewport: z.enum(["desktop", "mobile"]),
	index: z.number().int().nonnegative(),
	total: z.number().int().positive(),
	y: z.number().int().nonnegative(),
	height: z.number().int().positive(),
	path: z.string(),
});
export const ScreenshotManifest = z.object({ htmlPath: z.string(), tiles: z.array(ScreenshotTile).min(1) });
export const VisualWarnings = z.looseObject({
	status: z.literal("done-with-warnings"),
	reason: z.string(),
	chapters: z.record(z.string(), z.unknown()).default({}),
	engineIssues: z.array(z.string()).default([]),
});

const outputContract = <S extends z.ZodType>(name: string, schema: S): S => contract(`odyssey.${name}`, "1", schema);

export const InitialResearchOutput = outputContract("initial-research", InitialResearch.clone());
export const NarrativeSkeletonOutput = outputContract("narrative-skeleton-output", narrativeSkeletonSchema());
export const DeepResearchAgendaOutput = outputContract("deep-research-agenda-output", deepResearchAgendaSchema());
export const TakeManifestOutput = outputContract("take-manifest", TakeManifest.clone());
export const GateFeedbackOutput = outputContract("gate-feedback", GateFeedback.clone());
export const EvidenceIndexOutput = outputContract("evidence-index-output", evidenceIndexSchema());
export const EvidenceManifestOutput = outputContract("evidence-manifest", EvidenceManifest.clone());
export const EvidenceRegisterPatchOutput = outputContract("evidence-register-patch", EvidenceRegisterPatch.clone());
export const BeatDraftOutput = outputContract("beat-draft-output", beatDraftSchema());
export const SectionBeatWorkItemsOutput = outputContract("section-beat-work-items", SectionBeatWorkItems.clone());
export const SectionBeatWorkReplyOutput = outputContract(
	"section-beat-work-reply",
	z.union([SectionBeatWorkItems.clone(), PlanGateFeedback.clone()]),
);
export const SectionBeatDraftOutput = outputContract("section-beat-draft-output", sectionBeatDraftSchema());
export const BeatVerdictOutput = outputContract("beat-verdict-output", beatVerdictSchema());
export const VisualWorkItemsOutput = outputContract("visual-work-items", VisualWorkItems.clone());
export const BeatItemsOutput = outputContract("beat-items", BeatItems.clone());
export const BeatPatchOutput = outputContract("beat-patch", BeatPatch.clone());
export const JsonPatchOutput = outputContract("json-patch", JsonPatch.clone());
export const ReportPlanOutput = outputContract("report-plan", ReportPlan.clone());
export const PlanManifestOutput = outputContract("plan-manifest", PlanManifest.clone());
export const PlanGateFeedbackOutput = outputContract("plan-gate-feedback", PlanGateFeedback.clone());
export const ClosureReviewOutput = outputContract("closure-review", ClosureReview.clone());
export const ExperiencePlanOutput = outputContract("experience-plan", ExperiencePlan.clone());
export const ChapterPlanOutput = outputContract("chapter-plan", ChapterPlan.clone());
export const VisualCatalogOutput = outputContract("visual-catalog", VisualCatalog.clone());
export const SectionPackageOutput = outputContract("section-package", SectionPackage.clone());
export const SectionWorkItemsOutput = outputContract("section-work-items", SectionWorkItems.clone());
export const ManuscriptGateFeedbackOutput = outputContract("manuscript-gate-feedback", ManuscriptGateFeedback.clone());
export const ReportDocumentOutput = outputContract("report-document", ReportDocument.clone());
export const DocumentManifestOutput = outputContract("document-manifest", DocumentManifest.clone());
export const RenderManifestOutput = outputContract("render-manifest", RenderManifest.clone());
export const RenderReviewOutput = outputContract("render-review", RenderReview.clone());
export const RenderValidationOutput = outputContract("render-validation", RenderValidation.clone());
export const ScreenshotManifestOutput = outputContract("screenshot-manifest", ScreenshotManifest.clone());
export const VisualWarningsOutput = outputContract("visual-warnings", VisualWarnings.clone());

export type SourceRecord = z.infer<typeof SourceRecord>;
export type InitialResearch = z.infer<typeof InitialResearch>;
export type NarrativeSkeleton = z.infer<typeof NarrativeSkeleton>;
export type TakeManifest = z.infer<typeof TakeManifest>;
export type DeepResearchTake = z.infer<typeof DeepResearchTake>;
export type DeepResearchAgenda = z.infer<typeof DeepResearchAgenda>;
export type GateFeedback = z.infer<typeof GateFeedback>;
export type DeepResearch = z.infer<typeof DeepResearch>;
export type EvidenceItem = z.infer<typeof EvidenceItem>;
export type EvidenceIndex = z.infer<typeof EvidenceIndex>;
export type EvidenceManifest = z.infer<typeof EvidenceManifest>;
export type EvidenceRegisterPatch = z.infer<typeof EvidenceRegisterPatch>;
export type StrategySection = z.infer<typeof StrategySection>;
export type NarrativeStrategy = z.infer<typeof NarrativeStrategy>;
export type Beat = z.infer<typeof Beat>;
export type BeatDraft = z.infer<typeof BeatDraft>;
export type BeatWorkItem = z.infer<typeof BeatWorkItem>;
export type BeatItems = z.infer<typeof BeatItems>;
export type BeatPatch = z.infer<typeof BeatPatch>;
export type JsonPatch = z.infer<typeof JsonPatch>;
export type BeatPacket = z.infer<typeof BeatPacket>;
export type SectionBeatWorkItem = z.infer<typeof SectionBeatWorkItem>;
export type SectionBeatWorkItems = z.infer<typeof SectionBeatWorkItems>;
export type SectionBeatDraft = z.infer<typeof SectionBeatDraft>;
export type VerifiedBeat = z.infer<typeof VerifiedBeat>;
export type BeatVerdict = z.infer<typeof BeatVerdict>;
export type ReportPlan = z.infer<typeof ReportPlan>;
export type ClosureReview = z.infer<typeof ClosureReview>;
export type PlanGateFeedback = z.infer<typeof PlanGateFeedback>;
export type ChartVariant = z.infer<typeof ChartVariant>;
export type VisualOutput = z.infer<typeof VisualOutput>;
export type VisualRequest = z.infer<typeof VisualRequest>;
export type ExperienceBeat = z.infer<typeof ExperienceBeat>;
export type ExperienceSection = z.infer<typeof ExperienceSection>;
export type ExperiencePlan = z.infer<typeof ExperiencePlan>;
export type ChapterPlan = z.infer<typeof ChapterPlan>;
export type DatasetField = z.infer<typeof DatasetField>;
export type Dataset = z.infer<typeof Dataset>;
export type ImageAsset = z.infer<typeof ImageAsset>;
export type VisualInput = z.infer<typeof VisualInput>;
export type VisualCatalog = z.infer<typeof VisualCatalog>;
export type VisualPacket = z.infer<typeof VisualPacket>;
export type VisualWorkItem = z.infer<typeof VisualWorkItem>;
export type VisualWorkItems = z.infer<typeof VisualWorkItems>;
export type RichBlock = z.infer<typeof RichBlock>;
export type ElementPackage = z.infer<typeof ElementPackage>;
export type SectionModule = z.infer<typeof SectionModule>;
export type SectionPackage = z.infer<typeof SectionPackage>;
export type SectionWorkItem = z.infer<typeof SectionWorkItem>;
export type SectionWorkItems = z.infer<typeof SectionWorkItems>;
export type ManuscriptGateFeedback = z.infer<typeof ManuscriptGateFeedback>;
export type ReportDocument = z.infer<typeof ReportDocument>;
export type RenderReview = z.infer<typeof RenderReview>;
export type RenderValidation = z.infer<typeof RenderValidation>;
export type ScreenshotTile = z.infer<typeof ScreenshotTile>;
export type ScreenshotManifest = z.infer<typeof ScreenshotManifest>;
export type VisualWarnings = z.infer<typeof VisualWarnings>;
export type TableValue = {
	series: string;
	value: string | number | boolean | null | number[];
	missing?: boolean;
	forecast?: boolean;
};
