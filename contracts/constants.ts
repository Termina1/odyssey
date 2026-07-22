export const RESEARCH_CAPS = {
	skim: { deepTakeCap: 4, maxSourcesPerTake: 4, maxEvidencePerTake: 8 },
	standard: { deepTakeCap: 10, maxSourcesPerTake: 8, maxEvidencePerTake: 20 },
	deep: { deepTakeCap: 24, maxSourcesPerTake: 16, maxEvidencePerTake: 48 },
} as const;

export const PRODUCTION_CAPS = {
	draft: { chapterRewriteCap: 0, visualQaPasses: 0 },
	report: { chapterRewriteCap: 2, visualQaPasses: 1 },
	release: { chapterRewriteCap: 3, visualQaPasses: 2 },
} as const;

export type EvidenceDepth = keyof typeof RESEARCH_CAPS;
export type ProductionPolish = keyof typeof PRODUCTION_CAPS;
