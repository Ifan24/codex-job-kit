import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { lookupJob } = await import(path.join(trackerRoot, "src/lib/db.js"));

const candidateSchema = z.object({
  sourceId: z.string(),
  platform: z.string(),
  sourceType: z.string(),
  postingUrl: z.string().url(),
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  location: z.string().optional().default(""),
  workMode: z.string().optional().default(""),
  searchLane: z.string().optional().default(""),
  trackerLookup: z
    .object({
      found: z.boolean().optional(),
      shouldExcludeFromRecommendations: z.boolean().optional(),
    })
    .optional(),
});

const inputSchema = z.object({
  searchedAt: z.string().optional(),
  candidates: z.array(candidateSchema).default([]),
});

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm shortlist-batch-verify /absolute/or/relative/path/to/harvested-candidates.json",
      "  pnpm shortlist-batch-verify --stdin",
    ].join("\n"),
  );
}

function getFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
}

async function readFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    if (url.hostname.endsWith("seek.com.au") && url.pathname.startsWith("/job/")) {
      url.search = "";
    }
    if (url.hostname.endsWith("linkedin.com") && url.pathname.includes("/jobs/view/")) {
      url.search = "";
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function inferBrowserRequirement(candidate, fetchStatus, text) {
  const platform = String(candidate.platform || "").toLowerCase();
  const sourceType = String(candidate.sourceType || "").toLowerCase();
  const body = String(text || "").toLowerCase();

  if (platform === "linkedin") {
    return {
      browserRequired: true,
      browserReason: "LinkedIn requires logged-in UI verification for applied or live state.",
    };
  }

  if (platform === "seek") {
    return {
      browserRequired: true,
      browserReason: "SEEK requires logged-in UI verification for applied or live state.",
    };
  }

  if (sourceType === "aggregator") {
    return {
      browserRequired: true,
      browserReason: "Aggregator result still needs downstream target verification.",
    };
  }

  if (["blocked", "unknown", "error"].includes(fetchStatus)) {
    return {
      browserRequired: true,
      browserReason: "Batch fetch was inconclusive and needs browser-final verification.",
    };
  }

  if (body.includes("enable javascript") || body.includes("additional verification required")) {
    return {
      browserRequired: true,
      browserReason: "Page appears gated or client-rendered beyond reliable batch verification.",
    };
  }

  return {
    browserRequired: false,
    browserReason: "",
  };
}

function detectClosedReason(text) {
  const lower = String(text || "").toLowerCase();

  const checks = [
    "no longer accepting applications",
    "job posting you're looking for might have closed",
    "job posting has expired",
    "this job is no longer available",
    "position has been filled",
    "this position has been filled",
    "job has expired",
    "404 error",
  ];

  for (const phrase of checks) {
    if (lower.includes(phrase)) {
      return phrase;
    }
  }

  return "";
}

function collectLegitimacyFlags(text) {
  const lower = String(text || "").toLowerCase();
  const flags = [];

  if (!lower) {
    flags.push("empty_content");
  }

  if (lower.includes("additional verification required")) {
    flags.push("blocked_by_verification");
  }

  if (lower.includes("cloudflare")) {
    flags.push("cloudflare_block");
  }

  if (lower.includes("enable javascript")) {
    flags.push("javascript_required");
  }

  return flags;
}

async function fetchCandidate(candidate) {
  const normalizedUrl = normalizeUrl(candidate.postingUrl);
  const response = await fetch(normalizedUrl, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  const html = await response.text();
  const text = stripHtml(html);
  const closedReason = detectClosedReason(text);
  const legitimacyFlags = collectLegitimacyFlags(text);

  let fetchStatus = "ok";
  if (response.status >= 400) {
    fetchStatus = response.status === 404 ? "closed" : "error";
  } else if (closedReason) {
    fetchStatus = "closed";
  } else if (legitimacyFlags.includes("cloudflare_block") || legitimacyFlags.includes("blocked_by_verification")) {
    fetchStatus = "blocked";
  } else if (!text) {
    fetchStatus = "unknown";
  } else if (response.url !== normalizedUrl) {
    fetchStatus = "redirected";
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const extractedTitle = titleMatch ? stripHtml(titleMatch[1]) : candidate.title;

  return {
    normalizedUrl,
    fetchStatus,
    httpStatus: response.status,
    resolvedUrl: response.url,
    title: extractedTitle || candidate.title || "",
    company: candidate.company || "",
    location: candidate.location || "",
    employmentType: "",
    salaryText: "",
    closedReason,
    legitimacyFlags,
    notes: "",
    text,
  };
}

async function verifyCandidate(candidate) {
  const trackerLookup =
    candidate.trackerLookup && typeof candidate.trackerLookup.found === "boolean"
      ? candidate.trackerLookup
      : lookupJob({
          canonicalUrl: normalizeUrl(candidate.postingUrl),
          title: candidate.title,
          company: candidate.company,
        });

  let fetchResult = {
    normalizedUrl: normalizeUrl(candidate.postingUrl),
    fetchStatus: "unknown",
    httpStatus: null,
    resolvedUrl: candidate.postingUrl,
    title: candidate.title || "",
    company: candidate.company || "",
    location: candidate.location || "",
    employmentType: "",
    salaryText: "",
    closedReason: "",
    legitimacyFlags: [],
    notes: "",
    text: "",
  };

  try {
    fetchResult = await fetchCandidate(candidate);
  } catch (error) {
    fetchResult = {
      ...fetchResult,
      fetchStatus: "error",
      notes: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }

  const browserDecision = inferBrowserRequirement(
    candidate,
    fetchResult.fetchStatus,
    fetchResult.text,
  );

  return {
    sourceId: candidate.sourceId,
    postingUrl: candidate.postingUrl,
    normalizedUrl: fetchResult.normalizedUrl,
    fetchStatus: fetchResult.fetchStatus,
    httpStatus: fetchResult.httpStatus,
    resolvedUrl: fetchResult.resolvedUrl,
    title: fetchResult.title,
    company: fetchResult.company,
    location: fetchResult.location,
    employmentType: fetchResult.employmentType,
    salaryText: fetchResult.salaryText,
    trackerLookup,
    closedReason: fetchResult.closedReason,
    legitimacyFlags: fetchResult.legitimacyFlags,
    browserRequired: browserDecision.browserRequired,
    browserReason: browserDecision.browserReason,
    notes: fetchResult.notes,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const useStdin = args.includes("--stdin");
  const fileArg = args.find((arg) => !arg.startsWith("--"));

  if (!useStdin && !fileArg) {
    printUsage();
    process.exit(1);
  }

  const rawInput = useStdin
    ? await readFromStdin()
    : fs.readFileSync(path.resolve(process.cwd(), fileArg), "utf8");

  const payload = inputSchema.parse(JSON.parse(rawInput));
  const results = [];

  for (const candidate of payload.candidates) {
    results.push(await verifyCandidate(candidate));
  }

  const counts = {
    received: payload.candidates.length,
    checked: results.length,
    closed: results.filter((item) => item.fetchStatus === "closed").length,
    blocked: results.filter((item) => item.fetchStatus === "blocked").length,
    browserRequired: results.filter((item) => item.browserRequired).length,
  };

  console.log(
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        counts,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : "Unexpected batch verification error",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
