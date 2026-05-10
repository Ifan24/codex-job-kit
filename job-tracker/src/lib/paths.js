import path from "node:path";

export const trackerRoot = process.env.JOB_TRACKER_ROOT
  ? path.resolve(process.env.JOB_TRACKER_ROOT)
  : process.cwd();

function resolveTrackerPath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(trackerRoot, value);
}

export const databasePath = resolveTrackerPath(process.env.JOB_TRACKER_DB_PATH, path.join(trackerRoot, "data", "jobs.db"));
export const settingsPath = resolveTrackerPath(
  process.env.JOB_TRACKER_SETTINGS_PATH,
  path.join(trackerRoot, "data", "settings.json"),
);
export const storageRoot = resolveTrackerPath(process.env.JOB_TRACKER_STORAGE_ROOT, path.join(trackerRoot, "storage"));
export const coverLettersRoot = path.join(storageRoot, "cover_letters");
export const coverLetterDraftsRoot = path.join(storageRoot, "cover_letter_drafts");
export const importsRoot = path.join(storageRoot, "imports");
