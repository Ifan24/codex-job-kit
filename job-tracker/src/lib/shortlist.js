import { z } from "zod";

export const blockedSourceSchema = z.union([
  z.string(),
  z.object({
    source: z.string(),
    reason: z.string().optional(),
  }),
]);

export const shortlistJobSchema = z.object({
  canonicalUrl: z.string().url(),
  title: z.string(),
  company: z.string(),
  platform: z.string().optional(),
  location: z.string().optional(),
  workMode: z.string().optional(),
  employmentType: z.string().optional(),
  salaryText: z.string().optional(),
  sourceQuality: z.string().optional(),
  descriptionSummary: z.string().optional(),
  bucket: z.string().optional(),
  fitAssessment: z.string().optional(),
  riskNote: z.string().optional(),
  legitimacyNote: z.string().optional(),
});

export const shortlistSchema = z.object({
  searchedAt: z.string().optional(),
  promptVersion: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  summary: z.string().optional(),
  blockedSources: z.array(blockedSourceSchema).optional(),
  jobs: z.array(shortlistJobSchema).default([]),
});

export const applicationStatusSchema = z.enum([
  "not_started",
  "ready_to_apply",
  "skipped",
  "applied",
  "interview",
  "rejected",
  "closed",
]);

const trackerJobFields = {
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  platform: z.string().optional(),
  location: z.string().optional(),
  workMode: z.string().optional(),
  employmentType: z.string().optional(),
  salaryText: z.string().optional(),
  sourceQuality: z.string().optional(),
  descriptionSummary: z.string().optional(),
};

const trackedJobLocatorFields = {
  jobId: z.number().int().positive().optional(),
  canonicalUrl: z.string().url().optional(),
  title: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  platform: z.string().optional(),
  location: z.string().optional(),
  workMode: z.string().optional(),
  employmentType: z.string().optional(),
  salaryText: z.string().optional(),
  sourceQuality: z.string().optional(),
  descriptionSummary: z.string().optional(),
};

const reviewFields = {
  bucket: z.enum(["recommend", "borderline", "skip"]).optional(),
  fitAssessment: z.string().optional(),
  riskNote: z.string().optional(),
  legitimacyNote: z.string().optional(),
};

const checklistField = z.union([z.record(z.string(), z.unknown()), z.string()]).optional();

export const manualLeadSchema = z
  .object({
    ...trackedJobLocatorFields,
    ...reviewFields,
    applicationStatus: applicationStatusSchema.default("ready_to_apply"),
    applicationNotes: z.string().optional(),
    whyGoodFit: z.string().optional(),
    stoppedBecause: z.string().optional(),
    nextAction: z.string().optional(),
    checklist: checklistField,
  })
  .refine((payload) => payload.jobId || (payload.canonicalUrl && payload.title && payload.company), {
    message: "Provide jobId or canonicalUrl, title, and company.",
  });

export const applicationOutcomeSchema = z
  .object({
    ...trackedJobLocatorFields,
    ...reviewFields,
    appliedAt: z.string().optional(),
    applicationNotes: z.string().optional(),
    evidenceNote: z.string().optional(),
    checklist: checklistField,
  })
  .refine((payload) => payload.jobId || (payload.canonicalUrl && payload.title && payload.company), {
    message: "Provide jobId or canonicalUrl, title, and company.",
  });

export const statusUpdateSchema = z
  .object({
    jobId: z.number().int().positive().optional(),
    canonicalUrl: z.string().url().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    status: applicationStatusSchema,
    appliedAt: z.string().nullable().optional(),
    notes: z.string().optional(),
    checklist: checklistField,
  })
  .refine((payload) => payload.jobId || payload.canonicalUrl || (payload.title && payload.company), {
    message: "Provide jobId, canonicalUrl, or title and company.",
  });

export const workflowRunFinalizeSchema = z.object({
  runId: z.number().int().positive(),
  promptVersion: z.string().optional(),
  runQuality: z.enum(["good", "mixed", "degraded"]).optional(),
  promptUpdated: z.boolean().optional(),
  funnel: z
    .object({
      rawHarvested: z.number().int().nonnegative().optional(),
      uniqueAfterCheapDedupe: z.number().int().nonnegative().optional(),
      batchPreverified: z.number().int().nonnegative().optional(),
      batchExcluded: z.number().int().nonnegative().optional(),
      livePagesVerified: z.number().int().nonnegative().optional(),
      excludedTerminalDuplicates: z.number().int().nonnegative().optional(),
      importedRecommend: z.number().int().nonnegative().optional(),
      importedBorderline: z.number().int().nonnegative().optional(),
      importedSkip: z.number().int().nonnegative().optional(),
    })
    .optional(),
  laneReviews: z
    .array(
      z.object({
        lane: z.string(),
        source: z.string().optional(),
        laneId: z.string().optional(),
        wave: z.number().int().nonnegative().optional(),
        finishedCleanly: z.boolean().optional(),
        authStatus: z.enum(["stable", "unstable", "failed"]).optional(),
        rawCandidates: z.number().int().nonnegative().optional(),
        stableUrlsCaptured: z.number().int().nonnegative().optional(),
        candidatesReturned: z.number().int().nonnegative().optional(),
        recommendCount: z.number().int().nonnegative().optional(),
        borderlineCount: z.number().int().nonnegative().optional(),
        terminalDuplicateCount: z.number().int().nonnegative().optional(),
        blockedCount: z.number().int().nonnegative().optional(),
        score: z.number().optional(),
        suggestedStatus: z.enum(["active", "explore", "cooldown", "archived"]).optional(),
        nextTryAfter: z.string().optional(),
        blockedSources: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  workflowIssues: z.array(z.string()).optional(),
  nextRunAdjustments: z.array(z.string()).optional(),
  coverLetterSummary: z
    .object({
      generated: z.number().int().nonnegative().optional(),
      failed: z.number().int().nonnegative().optional(),
      notes: z.array(z.string()).optional(),
    })
    .optional(),
});

export function parseShortlistPayload(input) {
  return shortlistSchema.parse(input);
}

export function parseWorkflowRunFinalizePayload(input) {
  return workflowRunFinalizeSchema.parse(input);
}

export function parseManualLeadPayload(input) {
  return manualLeadSchema.parse(input);
}

export function parseApplicationOutcomePayload(input) {
  return applicationOutcomeSchema.parse(input);
}

export function parseStatusUpdatePayload(input) {
  return statusUpdateSchema.parse(input);
}
