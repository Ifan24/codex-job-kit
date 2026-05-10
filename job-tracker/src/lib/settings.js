import { statusLabels } from "./statuses";

const linkedinLanes = [
  {
    id: "linkedin-primary-role-query",
    label: "Primary role families",
    kind: "query",
    value: "<ROLE_FAMILIES> roles in <TARGET_LOCATIONS> posted recently",
  },
  {
    id: "linkedin-seniority-query",
    label: "Seniority fit",
    kind: "query",
    value: "<EXPERIENCE_RANGE> <ROLE_FAMILIES> roles with <WORK_MODES> options",
  },
  {
    id: "linkedin-stack-query",
    label: "Stack and domain fit",
    kind: "query",
    value: "<CORE_SKILLS> <ROLE_FAMILIES> roles at product, platform, or applied AI teams",
  },
];

const seekLanes = [
  {
    id: "seek-primary-role-query",
    label: "Primary role families",
    kind: "query",
    value: "<ROLE_FAMILIES> roles in <TARGET_LOCATIONS>",
  },
  {
    id: "seek-work-mode-query",
    label: "Work mode fit",
    kind: "query",
    value: "<ROLE_FAMILIES> roles matching <WORK_MODES> and <EXPERIENCE_RANGE>",
  },
];

const defaultSearchSources = Object.freeze({
  linkedin: {
    label: "LinkedIn",
    enabled: true,
    tier: "primary",
    executionMode: "cookie_shared_isolated",
    authCheckUrl: "https://www.linkedin.com/jobs/",
    maxPages: 3,
    notes: "Use signed-in state. Treat each lane as paginated and scroll result columns before judging a page exhausted.",
    lanes: linkedinLanes,
  },
  seek: {
    label: "SEEK",
    enabled: true,
    tier: "primary",
    executionMode: "single_owner_connected_browser",
    authCheckUrl: "https://www.seek.com.au/",
    maxPages: 2,
    notes: "Prefer a single owner when site challenges appear. Check adjacent title lanes when software engineer results are thin or senior-heavy.",
    lanes: seekLanes,
  },
  ats: {
    label: "ATS / company pages",
    enabled: true,
    tier: "supplemental",
    executionMode: "direct_http_or_browser",
    authCheckUrl: "",
    maxPages: 1,
    notes: "Use official ATS or direct company career pages when boards are noisy, blocked, duplicated, or thin.",
    lanes: [
      {
        id: "ats-official-company-pages",
        label: "Official company / ATS discovery",
        kind: "query",
        value: "official ATS and company career pages for <TARGET_LOCATIONS> <ROLE_FAMILIES> roles",
      },
    ],
  },
  jora: {
    label: "Jora",
    enabled: false,
    tier: "supplemental",
    executionMode: "cookie_shared_isolated",
    authCheckUrl: "https://www.jora.com/",
    maxPages: 1,
    notes: "Discovery layer only. Resolve downstream employer or ATS page before importing a recommend or borderline role.",
    lanes: [
      {
        id: "jora-discovery-query",
        label: "Discovery query",
        kind: "query",
        value: "<ROLE_FAMILIES> roles in <TARGET_LOCATIONS>",
      },
    ],
  },
  indeed: {
    label: "Indeed",
    enabled: false,
    tier: "supplemental",
    executionMode: "single_owner_connected_browser",
    authCheckUrl: "https://www.indeed.com/",
    maxPages: 1,
    notes: "Discovery layer only. Do not use Indeed as canonical for recommend or borderline roles unless the downstream page is verified.",
    lanes: [
      {
        id: "indeed-discovery-query",
        label: "Discovery query",
        kind: "query",
        value: "<ROLE_FAMILIES> roles in <TARGET_LOCATIONS>",
      },
    ],
  },
});

export const defaultTrackerSettings = Object.freeze({
  workflow: {
    defaultSortMode: "priority",
    showArchiveOnHome: false,
    highlightMissingCoverLetters: true,
    timelineWindowDays: 14,
    includeBorderlineRoles: true,
    requireLiveVerification: true,
  },
  documents: {
    generateCoverLetters: true,
    tailorResume: false,
    includeFallbackPrompt: true,
  },
  sources: {
    linkedin: true,
    seek: true,
    ats: true,
    jora: false,
    indeed: false,
  },
  searchSources: defaultSearchSources,
  candidate: {
    preferredLocation: "<TARGET_LOCATIONS>",
    workModes: ["hybrid", "remote"],
    seniority: "early_career",
  },
  statusLabels,
});

function sanitizeWorkflowSettings(input = {}) {
  const workflow = {
    ...defaultTrackerSettings.workflow,
    ...(input || {}),
  };

  const allowedSortModes = new Set(["priority", "company", "location"]);
  const allowedTimelineDays = new Set([7, 14, 30]);

  return {
    defaultSortMode: allowedSortModes.has(workflow.defaultSortMode)
      ? workflow.defaultSortMode
      : defaultTrackerSettings.workflow.defaultSortMode,
    showArchiveOnHome: Boolean(workflow.showArchiveOnHome),
    highlightMissingCoverLetters: Boolean(workflow.highlightMissingCoverLetters),
    timelineWindowDays: allowedTimelineDays.has(Number(workflow.timelineWindowDays))
      ? Number(workflow.timelineWindowDays)
      : defaultTrackerSettings.workflow.timelineWindowDays,
    includeBorderlineRoles: Boolean(workflow.includeBorderlineRoles),
    requireLiveVerification: Boolean(workflow.requireLiveVerification),
  };
}

function sanitizeDocumentSettings(input = {}) {
  const documents = {
    ...defaultTrackerSettings.documents,
    ...(input || {}),
  };

  return {
    generateCoverLetters: Boolean(documents.generateCoverLetters),
    tailorResume: Boolean(documents.tailorResume),
    includeFallbackPrompt: Boolean(documents.includeFallbackPrompt),
  };
}

function sanitizeSourceSettings(input = {}, searchSources = null) {
  const sources = {
    ...defaultTrackerSettings.sources,
    ...(input || {}),
  };

  return Object.fromEntries(
    Object.entries(defaultTrackerSettings.sources).map(([source]) => [
      source,
      searchSources?.[source] ? Boolean(searchSources[source].enabled) : Boolean(sources[source]),
    ]),
  );
}

function sanitizeSearchSourceId(value, fallback) {
  const id = sanitizeText(value, fallback, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return id || fallback;
}

function sanitizeText(value, fallback = "", maxLength = 2000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function sanitizeUrl(value, fallback = "") {
  const text = sanitizeText(value, fallback, 1200);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeSearchLane(lane = {}, source, index) {
  const fallback = defaultTrackerSettings.searchSources[source]?.lanes?.[index] || {};
  const allowedKinds = new Set(["url", "query"]);
  const kind = allowedKinds.has(lane.kind) ? lane.kind : allowedKinds.has(fallback.kind) ? fallback.kind : "url";
  const fallbackValue = fallback.value || "";
  const rawValue = sanitizeText(lane.value, fallbackValue, 1600);
  const value = kind === "url" ? sanitizeUrl(rawValue, fallbackValue) : rawValue;

  return {
    id: sanitizeText(lane.id, fallback.id || `${source}-lane-${index + 1}`, 80)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    label: sanitizeText(lane.label, fallback.label || `Lane ${index + 1}`, 120),
    kind,
    value,
  };
}

function sanitizeSearchSourceSettings(input = {}, sourceBooleans = {}) {
  const allowedTiers = new Set(["primary", "supplemental", "disabled"]);
  const allowedExecutionModes = new Set([
    "cookie_shared_isolated",
    "single_owner_connected_browser",
    "direct_http_or_browser",
  ]);

  const candidates = new Map(Object.entries(defaultTrackerSettings.searchSources));
  Object.entries(input || {}).forEach(([source, config], index) => {
    const sourceId = sanitizeSearchSourceId(source, `custom-source-${index + 1}`);
    candidates.set(sourceId, config);
  });

  return Object.fromEntries(
    Array.from(candidates.entries()).map(([source, defaultsOrCandidate]) => {
      const defaults = defaultTrackerSettings.searchSources[source] || {
        label: source
          .split("-")
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        enabled: true,
        tier: "supplemental",
        executionMode: "direct_http_or_browser",
        authCheckUrl: "",
        maxPages: 1,
        notes: "",
        lanes: [],
      };
      const candidate = input?.[source] || (defaultTrackerSettings.searchSources[source] ? {} : defaultsOrCandidate || {});
      const enabled =
        candidate.enabled !== undefined
          ? Boolean(candidate.enabled)
          : sourceBooleans[source] !== undefined
            ? Boolean(sourceBooleans[source])
            : Boolean(defaults.enabled);
      const lanes = Array.isArray(candidate.lanes) ? candidate.lanes : defaults.lanes;

      return [
        source,
        {
          label: sanitizeText(candidate.label, defaults.label, 80),
          enabled,
          tier: enabled
            ? allowedTiers.has(candidate.tier)
              ? candidate.tier
              : defaults.tier
            : "disabled",
          executionMode: allowedExecutionModes.has(candidate.executionMode)
            ? candidate.executionMode
            : defaults.executionMode,
          authCheckUrl: sanitizeUrl(candidate.authCheckUrl, defaults.authCheckUrl),
          maxPages: Number.isInteger(Number(candidate.maxPages))
            ? Math.max(1, Math.min(Number(candidate.maxPages), 5))
            : defaults.maxPages,
          notes: sanitizeText(candidate.notes, defaults.notes, 700),
          lanes: lanes.slice(0, 16).map((lane, index) => sanitizeSearchLane(lane, source, index)),
        },
      ];
    }),
  );
}

function sanitizeCandidateSettings(input = {}) {
  const candidate = {
    ...defaultTrackerSettings.candidate,
    ...(input || {}),
  };
  const allowedWorkModes = new Set(["remote", "hybrid", "onsite"]);
  const allowedSeniority = new Set(["early_career", "mid_level", "stretch"]);
  const workModes = Array.isArray(candidate.workModes)
    ? candidate.workModes.filter((mode) => allowedWorkModes.has(mode))
    : defaultTrackerSettings.candidate.workModes;

  return {
    preferredLocation:
      typeof candidate.preferredLocation === "string" && candidate.preferredLocation.trim()
        ? candidate.preferredLocation.trim().slice(0, 80)
        : defaultTrackerSettings.candidate.preferredLocation,
    workModes: workModes.length ? workModes : defaultTrackerSettings.candidate.workModes,
    seniority: allowedSeniority.has(candidate.seniority)
      ? candidate.seniority
      : defaultTrackerSettings.candidate.seniority,
  };
}

function sanitizeStatusLabels(input = {}) {
  return Object.fromEntries(
    Object.entries(statusLabels).map(([status, defaultLabel]) => {
      const candidate = input?.[status];
      return [status, typeof candidate === "string" && candidate.trim() ? candidate.trim() : defaultLabel];
    }),
  );
}

export function mergeTrackerSettings(storedSettings = {}) {
  const searchSources = sanitizeSearchSourceSettings(storedSettings.searchSources, storedSettings.sources);

  return {
    workflow: sanitizeWorkflowSettings(storedSettings.workflow),
    documents: sanitizeDocumentSettings(storedSettings.documents),
    sources: sanitizeSourceSettings(storedSettings.sources, searchSources),
    searchSources,
    candidate: sanitizeCandidateSettings(storedSettings.candidate),
    statusLabels: sanitizeStatusLabels(storedSettings.statusLabels),
  };
}

export function normalizeSettingsPatch(patch = {}) {
  const searchSources = patch.searchSources
    ? sanitizeSearchSourceSettings(patch.searchSources, patch.sources)
    : undefined;

  return {
    workflow: patch.workflow ? sanitizeWorkflowSettings(patch.workflow) : undefined,
    documents: patch.documents ? sanitizeDocumentSettings(patch.documents) : undefined,
    sources: patch.sources || searchSources ? sanitizeSourceSettings(patch.sources, searchSources) : undefined,
    searchSources,
    candidate: patch.candidate ? sanitizeCandidateSettings(patch.candidate) : undefined,
    statusLabels: patch.statusLabels ? sanitizeStatusLabels(patch.statusLabels) : undefined,
  };
}
