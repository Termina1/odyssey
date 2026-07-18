import { z } from "zod";

export const HttpUrl = z.string().url().refine((value) => {
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

export const DeepResearchTake = z.object({
	id: z.string(),
	title: z.string(),
	question: z.string(),
	rationale: z.string(),
	priority: z.enum(["high", "medium", "low"]),
	queries: z.array(z.string()),
	preferredSourceTypes: z.array(z.string()),
	acceptanceCriteria: z.array(z.string()),
});

export const DeepResearchAgenda = z.object({
	takes: z.record(z.string(), DeepResearchTake),
});

export const GateFeedback = z.object({
	reason: z.string(),
	missingEvidence: z.array(z.string()),
	followupQueries: z.array(z.string()),
	preserveFindings: z.array(z.string()),
});

export const DeepResearch = z.object({
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
	acceptanceCriteria: z.array(
		z.object({
			criterion: NonEmptyText,
			satisfied: z.boolean(),
			evidenceIds: z.array(z.string()),
		}),
	),
}).superRefine((research, context) => {
	const sourceIds = new Set<string>();
	for (const [index, source] of research.sources.entries()) {
		if (sourceIds.has(source.id)) context.addIssue({ code: "custom", path: ["sources", index, "id"], message: `Duplicate source id ${source.id}` });
		sourceIds.add(source.id);
	}
	const findingIds = new Set<string>();
	for (const [index, finding] of research.findings.entries()) {
		if (findingIds.has(finding.id)) context.addIssue({ code: "custom", path: ["findings", index, "id"], message: `Duplicate finding id ${finding.id}` });
		findingIds.add(finding.id);
		for (const [sourceIndex, sourceId] of finding.sourceIds.entries()) if (!sourceIds.has(sourceId)) context.addIssue({ code: "custom", path: ["findings", index, "sourceIds", sourceIndex], message: `Unknown source id ${sourceId}` });
	}
	for (const [criterionIndex, criterion] of research.acceptanceCriteria.entries()) {
		for (const [evidenceIndex, evidenceId] of criterion.evidenceIds.entries()) if (!findingIds.has(evidenceId)) context.addIssue({ code: "custom", path: ["acceptanceCriteria", criterionIndex, "evidenceIds", evidenceIndex], message: `Unknown evidence id ${evidenceId}` });
	}
});

export const TakeManifest = z.object({
	takeId: z.string(),
	artifactPath: z.string(),
	sourceCount: z.number().int().nonnegative(),
	evidenceCount: z.number().int().nonnegative(),
});

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

export const EvidenceIndex = z.object({
	evidence: z.array(EvidenceItem),
	sources: z.array(EvidenceSource),
	contradictions: z.array(z.object({ description: z.string(), takeIds: z.array(z.string()) })),
	gaps: z.array(z.object({ description: z.string(), takeIds: z.array(z.string()) })),
	counts: z.object({
		takes: z.number().int().nonnegative(),
		evidence: z.number().int().nonnegative(),
		sources: z.number().int().nonnegative(),
	}),
});

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

export const NarrativeStrategy = z.object({
	title: z.string(),
	objective: z.string(),
	thesis: z.string(),
	readerQuestion: z.string(),
	sections: z.array(StrategySection),
	exclusions: z.array(z.string()),
	styleNotes: z.array(z.string()),
});

export const Beat = z.object({
	id: z.string(),
	sectionId: z.string(),
	narrativePurpose: z.string(),
	takeaway: z.string(),
	evidenceIds: z.array(z.string()),
	caveat: z.string().optional(),
});

export const BeatDraft = z.object({ beats: z.array(Beat) });

export const BeatWorkItem = Beat.extend({
	index: z.number().int().nonnegative(),
	packetPath: z.string(),
});

export const BeatItems = z.object({
	items: z.record(z.string(), BeatWorkItem),
	count: z.number().int().nonnegative(),
	artifactPath: z.string(),
});
export const BeatPacket = z.object({ beat: BeatWorkItem, evidence: z.array(EvidenceItem), sources: z.array(SourceRecord) });

export const VerifiedBeat = z.object({
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
});

export const ReportPlan = z.object({
	title: z.string(),
	objective: z.string(),
	thesis: z.string(),
	readerQuestion: z.string(),
	sections: z.array(StrategySection.extend({ beatIds: z.array(z.string()) })),
	beats: z.array(VerifiedBeat),
	exclusions: z.array(z.string()),
	styleNotes: z.array(z.string()),
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

export const ChartVariant = z.enum(["line", "area", "bar", "stacked-bar", "grouped-bar", "100%-stacked-bar", "scatter", "bubble", "heatmap", "treemap", "sunburst", "sankey"]);
export const VisualOutput = z.enum([...ChartVariant.options, "table", "metric-strip", "photo", "product-screenshot", "map"]);

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
	fallback: z.enum(["table", "diagram", "callout", "prose"]),
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
	provenance: z.array(z.object({ sourceUrl: z.string(), evidenceId: z.string().optional(), extractionNote: z.string() })),
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
export const VisualInput = z.object({
	requestId: z.string(),
	kind: z.enum(["dataset", "image", "screenshot", "map-data"]),
	status: z.enum(["usable", "not-found"]),
	sourceIds: z.array(z.string()),
	sourceUrls: z.array(z.string()),
	dataset: Dataset.optional(),
	image: ImageAsset.optional(),
	limitations: z.array(z.string()),
	fallback: z.enum(["table", "diagram", "callout", "prose"]).optional(),
});

export const VisualCatalog = z.object({
	sectionId: z.string(),
	inputs: z.array(VisualInput),
});

export const BlockBase = z.object({ id: z.string(), beatId: z.string(), title: z.string(), purpose: z.string(), evidenceIds: z.array(z.string()) });
export const RichBlock = z.discriminatedUnion("type", [
	BlockBase.extend({ type: z.literal("chart"), datasetRequestId: z.string(), variant: ChartVariant, encoding: z.record(z.string(), z.string()), annotations: z.array(z.object({ label: z.string(), x: z.union([z.string(), z.number()]).optional(), y: z.union([z.string(), z.number()]).optional() })), interaction: z.object({ tooltip: z.boolean(), zoom: z.boolean(), legendFilter: z.boolean() }), forecast: z.object({ field: z.string() }).optional() }),
	BlockBase.extend({
		type: z.literal("metric-strip"),
		datasetRequestId: z.string(),
		metrics: z.array(z.object({
			label: z.string(),
			valueField: z.string(),
			where: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
		})).min(1),
	}),
	BlockBase.extend({ type: z.literal("table"), datasetRequestId: z.string(), columns: z.array(z.string()) }),
	BlockBase.extend({ type: z.literal("comparison"), columns: z.array(z.object({ title: z.string(), body: z.string() })) }),
	BlockBase.extend({ type: z.literal("timeline"), items: z.array(z.object({ label: z.string(), body: z.string() })).min(2) }),
	BlockBase.extend({ type: z.literal("flow"), steps: z.array(z.object({ label: z.string(), body: z.string() })).min(2) }),
	BlockBase.extend({ type: z.literal("matrix"), cells: z.array(z.object({ x: z.string(), y: z.string(), title: z.string(), body: z.string() })).min(4), annotations: z.array(z.string()).optional() }),
	BlockBase.extend({ type: z.literal("callout"), tone: z.enum(["insight", "warning", "decision", "scope"]), body: z.string(), bullets: z.array(z.string()) }),
	BlockBase.extend({ type: z.literal("quote"), quote: z.string(), attribution: z.string() }),
	BlockBase.extend({ type: z.literal("image"), imageRequestId: z.string(), alt: z.string(), caption: z.string() }),
]);
export const ElementPackage = z.object({ sectionId: z.string(), blocks: z.array(RichBlock) });

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
export const SectionPackage = z.object({ sectionId: z.string(), title: z.string(), dek: z.string(), openingClaim: z.string(), modules: z.array(SectionModule), handoff: z.string() });
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
	experience: ExperienceSection,
	chapterPlanPath: z.string(),
	visualCatalogPath: z.string(),
	elementPath: z.string(),
	chapterPath: z.string(),
	reworkFeedback: ChapterReworkFeedback.optional(),
});
export const SectionWorkItems = z.object({ items: z.record(z.string(), SectionWorkItem), count: z.number().int().nonnegative() });
export const ManuscriptGateFeedback = z.object({
	reason: z.string(),
	chapters: z.record(z.string(), z.object({ owner: z.enum(["layout", "copy", "elements"]), instructions: z.array(z.string()) })),
	engineIssues: z.array(z.string()).optional(),
});
export const ReportDocument = z.looseObject({ version: z.literal("1"), meta: z.record(z.string(), z.unknown()), plan: ReportPlan, experience: ExperiencePlan, sections: z.array(SectionPackage), elements: z.array(ElementPackage), evidence: EvidenceIndex, visualInputs: z.array(VisualInput) });
export const DocumentManifest = z.object({ artifactPath: z.string(), sections: z.number().int().nonnegative(), blocks: z.number().int().nonnegative() });
export const RenderManifest = z.object({ artifactPath: z.string(), bytes: z.number().int().positive(), charts: z.number().int().nonnegative() });
export const RenderValidation = z.object({ artifactPath: z.string(), pass: z.boolean(), findings: z.number().int().nonnegative() });
export const RenderReview = z.object({ pass: z.boolean(), findings: z.array(z.object({ severity: z.string(), message: z.string() })) });
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
export const VisualWarnings = z.looseObject({ status: z.literal("done-with-warnings"), reason: z.string(), chapters: z.record(z.string(), z.unknown()).default({}), engineIssues: z.array(z.string()).default([]) });


export type SourceRecord = z.infer<typeof SourceRecord>;
export type InitialResearch = z.infer<typeof InitialResearch>;
export type DeepResearchTake = z.infer<typeof DeepResearchTake>;
export type DeepResearchAgenda = z.infer<typeof DeepResearchAgenda>;
export type GateFeedback = z.infer<typeof GateFeedback>;
export type DeepResearch = z.infer<typeof DeepResearch>;
export type TakeManifest = z.infer<typeof TakeManifest>;
export type EvidenceItem = z.infer<typeof EvidenceItem>;
export type EvidenceIndex = z.infer<typeof EvidenceIndex>;
export type EvidenceManifest = z.infer<typeof EvidenceManifest>;
export type StrategySection = z.infer<typeof StrategySection>;
export type NarrativeStrategy = z.infer<typeof NarrativeStrategy>;
export type Beat = z.infer<typeof Beat>;
export type BeatDraft = z.infer<typeof BeatDraft>;
export type BeatWorkItem = z.infer<typeof BeatWorkItem>;
export type BeatItems = z.infer<typeof BeatItems>;
export type BeatPacket = z.infer<typeof BeatPacket>;
export type VerifiedBeat = z.infer<typeof VerifiedBeat>;
export type ReportPlan = z.infer<typeof ReportPlan>;
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
export type RichBlock = z.infer<typeof RichBlock>;
export type ElementPackage = z.infer<typeof ElementPackage>;
export type SectionModule = z.infer<typeof SectionModule>;
export type SectionPackage = z.infer<typeof SectionPackage>;
export type SectionWorkItem = z.infer<typeof SectionWorkItem>;
export type SectionWorkItems = z.infer<typeof SectionWorkItems>;
export type ManuscriptGateFeedback = z.infer<typeof ManuscriptGateFeedback>;
export type ReportDocument = z.infer<typeof ReportDocument>;
export type RenderReview = z.infer<typeof RenderReview>;
export type ScreenshotTile = z.infer<typeof ScreenshotTile>;
export type ScreenshotManifest = z.infer<typeof ScreenshotManifest>;
export type VisualWarnings = z.infer<typeof VisualWarnings>;
export type TableValue = { series: string; value: string | number | boolean | null | number[]; missing?: boolean; forecast?: boolean };
