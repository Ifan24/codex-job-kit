import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(trackerRoot, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "job-tracker-smoke-"));

process.env.JOB_TRACKER_ROOT = trackerRoot;
process.env.JOB_TRACKER_DB_PATH = path.join(tempRoot, "jobs.db");
process.env.JOB_TRACKER_STORAGE_ROOT = path.join(tempRoot, "storage");
process.env.JOB_TRACKER_SETTINGS_PATH = path.join(tempRoot, "settings.json");

const db = await import(path.join(trackerRoot, "src/lib/db.js"));
const parsers = await import(path.join(trackerRoot, "src/lib/shortlist.js"));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const shortlist = parsers.parseShortlistPayload(readJson("examples/shortlists/sample-shortlist.json"));
const importResult = db.importShortlist(shortlist);
assert(importResult.counts.created === 2, "Expected sample shortlist to create 2 jobs.");

const lookupBatch = db.lookupJobsBatch(shortlist.jobs);
assert(lookupBatch.every((item) => item.found), "Expected batch lookup to find imported sample jobs.");

const finalizePayload = parsers.parseWorkflowRunFinalizePayload({
  ...readJson("examples/shortlists/sample-run-finalize.json"),
  runId: importResult.runId,
});
const finalizedRun = db.finalizeSearchRun(finalizePayload);
assert(finalizedRun.runQuality === "good", "Expected sample run finalization to succeed.");

const lanePerformance = db.getLanePerformanceData({ limit: 7 });
assert(lanePerformance.lanes.length === 1, "Expected sample lane performance to include one lane.");

const manualLead = parsers.parseManualLeadPayload(readJson("examples/application/manual-lead.json"));
const capturedLead = db.captureLead(manualLead);
assert(capturedLead.status === "ready_to_apply", "Expected manual lead to be ready_to_apply.");

const applicationOutcome = parsers.parseApplicationOutcomePayload(readJson("examples/application/application-outcome.json"));
const loggedApplication = db.logApplicationOutcome(applicationOutcome);
assert(loggedApplication.status === "applied", "Expected application outcome to be applied.");

const statusUpdate = parsers.parseStatusUpdatePayload(readJson("examples/application/status-update.json"));
const updatedStatus = db.updateJobStatus(statusUpdate);
assert(updatedStatus.status === "interview", "Expected status update to move the sample application to interview.");

const lookupApplied = db.lookupJob({
  canonicalUrl: applicationOutcome.canonicalUrl,
  title: applicationOutcome.title,
  company: applicationOutcome.company,
});
assert(lookupApplied.shouldExcludeFromRecommendations, "Expected terminal application to be excluded from recommendations.");

console.log(
  JSON.stringify(
    {
      ok: true,
      tempRoot,
      checks: {
        importedJobs: importResult.counts.created,
        batchLookupFound: lookupBatch.filter((item) => item.found).length,
        finalizedRunId: finalizedRun.id,
        laneRecords: lanePerformance.lanes.length,
        capturedLeadStatus: capturedLead.status,
        loggedApplicationStatus: loggedApplication.status,
        updatedStatus: updatedStatus.status,
        terminalLookupExcluded: lookupApplied.shouldExcludeFromRecommendations,
      },
    },
    null,
    2,
  ),
);
