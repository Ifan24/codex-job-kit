import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { createManualJob, findExistingJobMatch, upsertApplication } = await import(path.join(trackerRoot, "src/lib/db.js"));

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm import-applied-jobs-md /absolute/or/relative/path/to/applied_jobs.md",
    ].join("\n"),
  );
}

function parseAppliedJobsMarkdown(content) {
  const sections = content.split(/^## /gm).slice(1);
  const items = [];

  for (const section of sections) {
    if (section.startsWith("Current Applied Jobs")) continue;
    const lines = section.split("\n").filter(Boolean);
    const heading = lines[0]?.trim();
    if (!heading) continue;

    const getValue = (label) => {
      const line = lines.find((item) => item.startsWith(`- ${label}:`));
      return line ? line.replace(`- ${label}:`, "").trim() : "";
    };

    items.push({
      title: heading.split(" — ")[0]?.trim() || heading,
      company: getValue("Company"),
      platform: getValue("Source"),
      canonicalUrl: getValue("URL"),
      location: getValue("Location"),
      workMode: getValue("Work mode"),
      notes: getValue("Notes"),
      appliedAt: getValue("Applied date") === "Not recorded" ? null : getValue("Applied date"),
    });
  }

  return items.filter((item) => item.canonicalUrl && item.company);
}

const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!fileArg) {
  printUsage();
  process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), fileArg);
const jobs = parseAppliedJobsMarkdown(fs.readFileSync(sourcePath, "utf8"));
const summary = {
  sourcePath,
  received: jobs.length,
  created: 0,
  updated: 0,
  skipped: 0,
};

for (const job of jobs) {
  const existing = findExistingJobMatch({
    canonicalUrl: job.canonicalUrl,
    title: job.title,
    company: job.company,
  });

  if (existing?.jobId) {
    upsertApplication(existing.jobId, {
      status: "applied",
      appliedAt: job.appliedAt,
      notes: job.notes || "",
    });
    summary.updated += 1;
    continue;
  }

  try {
    createManualJob({
      canonicalUrl: job.canonicalUrl,
      title: job.title,
      company: job.company,
      platform: job.platform || "Legacy",
      location: job.location || "",
      workMode: job.workMode || "",
      sourceQuality: "legacy_markdown",
      descriptionSummary: "Imported from an explicit applied-jobs markdown migration.",
      bucket: "recommend",
      fitAssessment: "Imported from legacy applied-jobs markdown.",
      applicationStatus: "applied",
      applicationNotes: job.notes || "",
    });
    summary.created += 1;
  } catch (error) {
    summary.skipped += 1;
    console.error(
      JSON.stringify(
        {
          warning: error instanceof Error ? error.message : "Failed to import legacy job",
          title: job.title,
          company: job.company,
        },
        null,
        2,
      ),
    );
  }
}

console.log(JSON.stringify(summary, null, 2));
