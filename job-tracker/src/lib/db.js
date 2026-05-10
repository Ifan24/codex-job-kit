import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  coverLetterDraftsRoot,
  coverLettersRoot,
  databasePath,
  importsRoot,
} from "./paths.js";
import {
  ensureDir,
  fileExists,
  normalizeForMatch,
  slugify,
} from "./utils.js";

let sqlite;
let readOnlySqlite;
let initialized = false;
const terminalStatuses = new Set(["applied", "interview", "rejected", "closed"]);
const actionNeededPattern = /\b(verify|verification|assessment|action required|complete|requested|screening questions|interview|next step|next steps)\b/i;

function toEventDate(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseScheduledAt(notes) {
  if (!notes) return null;

  const match = notes.match(/scheduled for (\d{4}-\d{2}-\d{2})(?:[ ,T]+(\d{1,2}:\d{2}))?/i);
  if (!match) return null;

  const [, date, time] = match;
  const normalizedTime = time ? `${time}:00` : "12:00:00";
  return `${date}T${normalizedTime}`;
}

function dedupeAndSortTimelineEvents(events, limit = 18) {
  const seen = new Set();
  const now = Date.now();

  const sorted = events
    .filter((event) => {
      if (!event?.occurredAt) return false;
      const key = `${event.jobId}:${event.kind}:${event.occurredAt}:${event.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.occurredAt).getTime();
      const rightTime = new Date(right.occurredAt).getTime();
      const leftFuture = leftTime > now;
      const rightFuture = rightTime > now;

      if (leftFuture && !rightFuture) return -1;
      if (!leftFuture && rightFuture) return 1;
      if (leftFuture && rightFuture) return leftTime - rightTime;
      return rightTime - leftTime;
    });

  if (typeof limit === "number" && Number.isFinite(limit)) {
    return sorted.slice(0, limit);
  }

  return sorted;
}

function buildTimelineEvents({ jobRows, documentRows, reviewRows, limit = 18 }) {
  const events = [];
  const latestCoverLetterByJob = new Map();

  for (const row of documentRows) {
    const existing = latestCoverLetterByJob.get(row.jobId);
    if (!existing || new Date(row.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestCoverLetterByJob.set(row.jobId, row);
    }
  }

  for (const row of jobRows) {
    const base = {
      jobId: row.jobId,
      jobTitle: row.title,
      company: row.company,
      jobUrl: row.canonicalUrl,
      currentStatus: row.status || "not_started",
      notes: row.notes || "",
      appliedAt: row.appliedAt || null,
    };

    const discoveredAt = toEventDate(row.reviewCreatedAt || row.jobCreatedAt);
    if (discoveredAt) {
      events.push({
        ...base,
        kind: "queued",
        tone: row.bucket === "recommend" ? "recommend" : row.bucket === "borderline" ? "borderline" : "skip",
        occurredAt: discoveredAt,
        title: row.bucket === "recommend" ? "Added to Apply Next" : "Captured in tracker",
        summary:
          row.bucket === "recommend"
            ? "Shortlisted as a strong-fit role."
            : row.bucket === "borderline"
            ? "Saved for later review."
            : "Recorded in the tracker for reference.",
      });
    }

    const appliedAt = toEventDate(row.appliedAt);
    if (appliedAt) {
      events.push({
        ...base,
        kind: "applied",
        tone: "applied",
        occurredAt: appliedAt,
        title: "Application submitted",
        summary: "Application was marked as submitted.",
      });
    }

    if (row.status === "ready_to_apply") {
      events.push({
        ...base,
        kind: "prep_done",
        tone: "recommend",
        occurredAt: toEventDate(row.applicationUpdatedAt) || discoveredAt,
        title: "Ready to apply",
        summary: "Role was staged for submission.",
      });
    }

    if (row.status === "interview") {
      const scheduledAt = toEventDate(parseScheduledAt(row.notes)) || toEventDate(row.applicationUpdatedAt) || appliedAt;
      events.push({
        ...base,
        kind: "interview",
        tone: "interview",
        occurredAt: scheduledAt,
        title: "Interview stage",
        summary: row.notes || "Interview progress recorded in the tracker.",
      });
    }

    if (row.status === "rejected") {
      events.push({
        ...base,
        kind: "rejected",
        tone: "rejected",
        occurredAt: toEventDate(row.applicationUpdatedAt) || appliedAt || discoveredAt,
        title: "Rejected",
        summary: row.notes || "Application was marked as rejected.",
      });
    }

    if (row.status === "skipped") {
      events.push({
        ...base,
        kind: "skipped",
        tone: "skip",
        occurredAt: toEventDate(row.applicationUpdatedAt) || discoveredAt,
        title: "Skipped",
        summary: row.notes || "Role was skipped and moved out of the active queue.",
      });
    }

    if (row.status === "closed") {
      events.push({
        ...base,
        kind: "closed",
        tone: "closed",
        occurredAt: toEventDate(row.applicationUpdatedAt) || discoveredAt,
        title: "Closed",
        summary: row.notes || "Role was marked as closed.",
      });
    }

    if (row.notes && actionNeededPattern.test(row.notes) && !["rejected", "closed", "skipped"].includes(row.status || "")) {
      events.push({
        ...base,
        kind: "action_required",
        tone: "action",
        occurredAt: toEventDate(row.applicationUpdatedAt) || appliedAt || discoveredAt,
        title: "Needs action",
        summary: row.notes,
      });
    }

    const document = latestCoverLetterByJob.get(row.jobId);
    if (document) {
      events.push({
        ...base,
        kind: "cover_letter",
        tone: "document",
        occurredAt: toEventDate(document.createdAt),
        title: document.format === "pdf" ? "Cover letter PDF stored" : "Cover letter stored",
        summary: document.filePath || "Cover letter assets were attached to this role.",
      });
    }
  }

  for (const row of reviewRows) {
    const reviewAt = toEventDate(row.createdAt);
    if (!reviewAt) continue;
    events.push({
      jobId: row.jobId,
      jobTitle: row.title,
      company: row.company,
      jobUrl: row.canonicalUrl,
      kind: "review",
      tone: row.bucket === "recommend" ? "recommend" : row.bucket === "borderline" ? "borderline" : "skip",
      occurredAt: reviewAt,
      title: row.bucket === "recommend" ? "Marked recommend" : row.bucket === "borderline" ? "Marked borderline" : "Marked skip",
      summary: row.fitAssessment || row.riskNote || row.legitimacyNote || "Tracker review updated.",
    });
  }

  return dedupeAndSortTimelineEvents(events, limit);
}

function readTimelineSourceRows() {
  const jobRows = all(`
    SELECT
      j.id AS jobId,
      j.title,
      j.company,
      j.canonical_url AS canonicalUrl,
      j.created_at AS jobCreatedAt,
      a.status,
      a.applied_at AS appliedAt,
      a.notes,
      a.updated_at AS applicationUpdatedAt,
      r.bucket,
      r.created_at AS reviewCreatedAt
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    LEFT JOIN reviews r ON r.id = (
      SELECT r2.id
      FROM reviews r2
      WHERE r2.job_id = j.id
      ORDER BY r2.created_at DESC, r2.id DESC
      LIMIT 1
    )
  `);
  const documentRows = all(`
    SELECT
      job_id AS jobId,
      format,
      file_path AS filePath,
      created_at AS createdAt
    FROM documents
    WHERE kind = 'cover_letter'
  `);
  const reviewRows = all(`
    SELECT
      r.job_id AS jobId,
      j.title,
      j.company,
      j.canonical_url AS canonicalUrl,
      r.bucket,
      r.fit_assessment AS fitAssessment,
      r.risk_note AS riskNote,
      r.legitimacy_note AS legitimacyNote,
      r.created_at AS createdAt
    FROM reviews r
    JOIN jobs j ON j.id = r.job_id
  `);

  return { jobRows, documentRows, reviewRows };
}

function createDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function shiftDateByDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatWindowLabel(date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildTimelineWindow({ events, days = 7, offset = 0 }) {
  const normalizedDays = Math.max(1, Math.min(30, Number(days) || 7));
  const normalizedOffset = Math.max(0, Number(offset) || 0);
  const today = getStartOfToday();
  const endDate = shiftDateByDays(today, -(normalizedOffset * normalizedDays));
  const startDate = shiftDateByDays(endDate, -(normalizedDays - 1));
  const rangeStartMs = startDate.getTime();
  const rangeEndMs = shiftDateByDays(endDate, 1).getTime();
  const todayKey = createDayKey(today);

  const dayMap = new Map();
  const dayEntries = [];
  for (let index = 0; index < normalizedDays; index += 1) {
    const current = shiftDateByDays(startDate, index);
    const key = createDayKey(current);
    const entry = {
      key,
      isoDate: key,
      label: formatWindowLabel(current),
      isToday: key === todayKey,
      events: [],
    };
    dayMap.set(key, entry);
    dayEntries.push(entry);
  }

  for (const event of events) {
    const occurredAt = new Date(event.occurredAt);
    const timestamp = occurredAt.getTime();
    if (Number.isNaN(timestamp) || timestamp < rangeStartMs || timestamp >= rangeEndMs) {
      continue;
    }

    const key = createDayKey(occurredAt);
    dayMap.get(key)?.events.push(event);
  }

  for (const entry of dayEntries) {
    entry.events.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  }

  const windowEvents = dayEntries.flatMap((entry) => entry.events);
  const oldestEventAt = events.length ? events[events.length - 1]?.occurredAt || null : null;
  const hasOlder = events.some((event) => {
    const timestamp = new Date(event.occurredAt).getTime();
    return !Number.isNaN(timestamp) && timestamp < rangeStartMs;
  });

  return {
    days: normalizedDays,
    offset: normalizedOffset,
    startDate: createDayKey(startDate),
    endDate: createDayKey(endDate),
    hasOlder,
    hasNewer: normalizedOffset > 0,
    oldestEventAt,
    counts: {
      total: windowEvents.length,
      actionRequired: windowEvents.filter((event) => event.kind === "action_required").length,
      applied: windowEvents.filter((event) => event.kind === "applied").length,
      interviews: windowEvents.filter((event) => event.kind === "interview").length,
    },
    dayEntries,
  };
}

function getDb() {
  if (!sqlite) {
    const dataDir = databasePath.replace(/\/[^/]+$/, "");
    ensureDir(dataDir);
    ensureDir(coverLetterDraftsRoot);
    ensureDir(coverLettersRoot);
    ensureDir(importsRoot);
    sqlite = new DatabaseSync(databasePath);
    sqlite.exec("PRAGMA journal_mode = WAL;");
    sqlite.exec("PRAGMA foreign_keys = ON;");
  }
  return sqlite;
}

function getReadOnlyDb() {
  if (!readOnlySqlite) {
    readOnlySqlite = new DatabaseSync(databasePath, { readOnly: true });
    readOnlySqlite.exec("PRAGMA query_only = ON;");
    readOnlySqlite.exec("PRAGMA foreign_keys = ON;");
  }

  return readOnlySqlite;
}

function snapshotFilePathForRun(runId, searchedAt) {
  const stamp = String(searchedAt || new Date().toISOString())
    .replace(/[:]/g, "-")
    .replace(/\..*$/, "")
    .replace("T", "_");
  const safeStamp = slugify(stamp) || "run";
  return `${importsRoot}/${safeStamp}-run-${runId}.json`;
}

function run(query, params = []) {
  return getDb().prepare(query).run(...params);
}

function get(query, params = []) {
  return getDb().prepare(query).get(...params);
}

function all(query, params = []) {
  return getDb().prepare(query).all(...params);
}

function getReadOnly(query, params = []) {
  return getReadOnlyDb().prepare(query).get(...params);
}

function allReadOnly(query, params = []) {
  return getReadOnlyDb().prepare(query).all(...params);
}

function ensureSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS search_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      searched_at TEXT NOT NULL,
      prompt_version TEXT,
      platforms TEXT,
      summary TEXT,
      run_quality TEXT,
      prompt_updated INTEGER NOT NULL DEFAULT 0,
      blocked_sources_json TEXT DEFAULT '[]',
      import_summary_json TEXT DEFAULT '{}',
      funnel_json TEXT DEFAULT '{}',
      lane_reviews_json TEXT DEFAULT '[]',
      workflow_issues_json TEXT DEFAULT '[]',
      next_run_adjustments_json TEXT DEFAULT '[]',
      cover_letter_summary_json TEXT DEFAULT '{}',
      snapshot_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      platform TEXT,
      location TEXT,
      work_mode TEXT,
      employment_type TEXT,
      salary_text TEXT,
      source_quality TEXT,
      description_summary TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      run_id INTEGER,
      bucket TEXT NOT NULL,
      fit_assessment TEXT,
      risk_note TEXT,
      legitimacy_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(run_id) REFERENCES search_runs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'not_started',
      applied_at TEXT,
      checklist_json TEXT DEFAULT '{}',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      format TEXT NOT NULL,
      label TEXT,
      file_path TEXT,
      text_content TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `);

  ensureColumn("search_runs", "prompt_version", "TEXT");
  ensureColumn("search_runs", "run_quality", "TEXT");
  ensureColumn("search_runs", "prompt_updated", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("search_runs", "import_summary_json", "TEXT DEFAULT '{}'");
  ensureColumn("search_runs", "funnel_json", "TEXT DEFAULT '{}'");
  ensureColumn("search_runs", "lane_reviews_json", "TEXT DEFAULT '[]'");
  ensureColumn("search_runs", "workflow_issues_json", "TEXT DEFAULT '[]'");
  ensureColumn("search_runs", "next_run_adjustments_json", "TEXT DEFAULT '[]'");
  ensureColumn("search_runs", "cover_letter_summary_json", "TEXT DEFAULT '{}'");
  ensureColumn("search_runs", "snapshot_path", "TEXT");
}

function ensureColumn(tableName, columnName, definition) {
  const columns = all(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) return;
  getDb().exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function safeJsonParse(rawValue, fallback) {
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function findSnapshotPathForRun(runId, existingPath = "") {
  if (existingPath && fileExists(existingPath)) return existingPath;
  if (!fileExists(importsRoot)) return "";

  const suffix = `-run-${runId}.json`;
  const match = fs
    .readdirSync(importsRoot)
    .find((fileName) => fileName.endsWith(suffix));

  return match ? `${importsRoot}/${match}` : "";
}

function loadRunSnapshot(runId, existingPath = "") {
  const snapshotPath = findSnapshotPathForRun(runId, existingPath);
  if (!snapshotPath) return { snapshotPath: "", snapshot: null };

  try {
    return {
      snapshotPath,
      snapshot: JSON.parse(fs.readFileSync(snapshotPath, "utf8")),
    };
  } catch {
    return { snapshotPath, snapshot: null };
  }
}

function buildImportSummaryFromSnapshot(snapshot) {
  const counts = snapshot?.results?.counts;
  const jobs = snapshot?.payload?.jobs || [];
  if (!counts && !jobs.length) return {};

  return {
    received: counts?.received ?? jobs.length,
    created: counts?.created ?? 0,
    updated: counts?.updated ?? 0,
    excludedExisting: counts?.excludedExisting ?? 0,
    ...summarizeImportedBuckets(jobs),
  };
}

function replaceDocument(jobId, kind, format, label, filePath, textContent = null) {
  run(`DELETE FROM documents WHERE job_id = ? AND kind = ? AND format = ?`, [jobId, kind, format]);
  run(
    `INSERT INTO documents (job_id, kind, format, label, file_path, text_content)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [jobId, kind, format, label, filePath, textContent],
  );
}

function getLatestReviewForJob(jobId) {
  return get(
    `SELECT *
     FROM reviews
     WHERE job_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [jobId],
  );
}

function getLatestReviewForJobWithGet(queryGet, jobId) {
  return queryGet(
    `SELECT *
     FROM reviews
     WHERE job_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [jobId],
  );
}

function getApplicationForJob(jobId) {
  return get(`SELECT * FROM applications WHERE job_id = ?`, [jobId]);
}

function getReadOnlyApplicationForJob(jobId) {
  return getReadOnly(`SELECT * FROM applications WHERE job_id = ?`, [jobId]);
}

function buildExistingMatch(job, matchType) {
  if (!job) return null;

  const application = getApplicationForJob(job.id);
  const review = getLatestReviewForJob(job.id);
  const status = application?.status || "not_started";

  return {
    jobId: job.id,
    canonicalUrl: job.canonical_url,
    title: job.title,
    company: job.company,
    platform: job.platform,
    location: job.location,
    workMode: job.work_mode,
    applicationStatus: status,
    reviewBucket: review?.bucket || null,
    matchType,
    isTerminal: terminalStatuses.has(status),
  };
}

function buildExistingMatchWithReaders(job, matchType, { getApplication, getLatestReview }) {
  if (!job) return null;

  const application = getApplication(job.id);
  const review = getLatestReview(job.id);
  const status = application?.status || "not_started";

  return {
    jobId: job.id,
    canonicalUrl: job.canonical_url,
    title: job.title,
    company: job.company,
    platform: job.platform,
    location: job.location,
    workMode: job.work_mode,
    applicationStatus: status,
    reviewBucket: review?.bucket || null,
    matchType,
    isTerminal: terminalStatuses.has(status),
  };
}

function normalizeLookupCanonicalUrl(value) {
  if (!value) return value;

  try {
    const url = new URL(value);
    url.hash = "";

    if (url.hostname === "au.seek.com") {
      url.hostname = "www.seek.com.au";
    }

    if (url.hostname.endsWith("seek.com.au") && url.pathname.startsWith("/job/")) {
      url.search = "";
    }

    if (url.hostname.endsWith("linkedin.com") && url.pathname.includes("/jobs/view/")) {
      url.search = "";
    }

    return url.toString();
  } catch {
    return value;
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function checklistToJson(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return undefined;
}

function compactNotes(parts) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

function upsertJobRecord(payload) {
  initDb();

  if (payload.jobId) {
    const existingJob = get("SELECT * FROM jobs WHERE id = ?", [payload.jobId]);
    if (!existingJob) {
      throw new Error(`Job not found: ${payload.jobId}`);
    }

    run(
      `UPDATE jobs
       SET title = ?, company = ?, platform = ?, location = ?, work_mode = ?, employment_type = ?,
           salary_text = ?, source_quality = ?, description_summary = ?, updated_at = ?
       WHERE id = ?`,
      [
        payload.title || existingJob.title,
        payload.company || existingJob.company,
        payload.platform ?? existingJob.platform,
        payload.location ?? existingJob.location,
        payload.workMode ?? existingJob.work_mode,
        payload.employmentType ?? existingJob.employment_type,
        payload.salaryText ?? existingJob.salary_text,
        payload.sourceQuality ?? existingJob.source_quality,
        payload.descriptionSummary ?? existingJob.description_summary,
        new Date().toISOString(),
        existingJob.id,
      ],
    );

    return {
      jobId: existingJob.id,
      created: false,
      matchType: "job_id",
      canonicalUrl: existingJob.canonical_url,
    };
  }

  const canonicalUrl = normalizeLookupCanonicalUrl(payload.canonicalUrl);
  if (!canonicalUrl) {
    throw new Error("canonicalUrl is required.");
  }

  const existingMatch = findExistingJobMatch({
    canonicalUrl,
    title: payload.title,
    company: payload.company,
  });
  const existingJob =
    get("SELECT * FROM jobs WHERE id = ?", [existingMatch?.jobId || -1]) ||
    get("SELECT * FROM jobs WHERE canonical_url = ?", [canonicalUrl]);
  const now = new Date().toISOString();

  if (existingJob) {
    run(
      `UPDATE jobs
       SET title = ?, company = ?, platform = ?, location = ?, work_mode = ?, employment_type = ?,
           salary_text = ?, source_quality = ?, description_summary = ?, updated_at = ?
       WHERE id = ?`,
      [
        payload.title || existingJob.title,
        payload.company || existingJob.company,
        payload.platform ?? existingJob.platform,
        payload.location ?? existingJob.location,
        payload.workMode ?? existingJob.work_mode,
        payload.employmentType ?? existingJob.employment_type,
        payload.salaryText ?? existingJob.salary_text,
        payload.sourceQuality ?? existingJob.source_quality,
        payload.descriptionSummary ?? existingJob.description_summary,
        now,
        existingJob.id,
      ],
    );

    return {
      jobId: existingJob.id,
      created: false,
      matchType: existingMatch?.matchType || "canonical_url",
      canonicalUrl: existingJob.canonical_url,
    };
  }

  const result = run(
    `INSERT INTO jobs (
      canonical_url, title, company, platform, location, work_mode, employment_type,
      salary_text, source_quality, description_summary, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      canonicalUrl,
      payload.title,
      payload.company,
      payload.platform || "",
      payload.location || "",
      payload.workMode || "",
      payload.employmentType || "",
      payload.salaryText || "",
      payload.sourceQuality || payload.defaultSourceQuality || "",
      payload.descriptionSummary || "",
      now,
    ],
  );

  return {
    jobId: Number(result.lastInsertRowid),
    created: true,
    matchType: "created",
    canonicalUrl,
  };
}

function insertReview(jobId, payload, defaultBucket = "recommend") {
  if (
    !payload.bucket &&
    !payload.fitAssessment &&
    !payload.riskNote &&
    !payload.legitimacyNote &&
    !defaultBucket
  ) {
    return null;
  }

  const result = run(
    `INSERT INTO reviews (job_id, bucket, fit_assessment, risk_note, legitimacy_note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      jobId,
      payload.bucket || defaultBucket,
      payload.fitAssessment || "",
      payload.riskNote || "",
      payload.legitimacyNote || "",
    ],
  );

  return Number(result.lastInsertRowid);
}

function resolveJobIdFromLocator(payload) {
  if (payload.jobId) {
    const job = get("SELECT * FROM jobs WHERE id = ?", [payload.jobId]);
    if (!job) throw new Error(`Job not found: ${payload.jobId}`);
    return payload.jobId;
  }

  const match = findExistingJobMatch({
    canonicalUrl: payload.canonicalUrl,
    title: payload.title,
    company: payload.company,
  });

  if (!match?.jobId) {
    throw new Error("Job not found. Provide an existing jobId, canonicalUrl, or title/company match.");
  }

  return match.jobId;
}

export function findExistingJobMatch({ canonicalUrl, title, company }) {
  initDb();

  if (canonicalUrl) {
    const normalizedUrl = normalizeLookupCanonicalUrl(canonicalUrl);
    const urlMatch = get(`SELECT * FROM jobs WHERE canonical_url = ?`, [normalizedUrl]);
    if (urlMatch) return buildExistingMatch(urlMatch, "canonical_url");
  }

  if (title && company) {
    const targetCompany = normalizeForMatch(company);
    const targetTitle = normalizeForMatch(title);
    const candidates = all(`SELECT * FROM jobs WHERE lower(company) = lower(?)`, [company]);

    const normalizedMatch = candidates.find((candidate) => {
      return (
        normalizeForMatch(candidate.company) === targetCompany &&
        normalizeForMatch(candidate.title) === targetTitle
      );
    });

    if (normalizedMatch) return buildExistingMatch(normalizedMatch, "normalized_company_title");
  }

  return null;
}

function findExistingJobMatchReadOnly({ canonicalUrl, title, company }) {
  if (canonicalUrl) {
    const normalizedUrl = normalizeLookupCanonicalUrl(canonicalUrl);
    const urlMatch = getReadOnly(`SELECT * FROM jobs WHERE canonical_url = ?`, [normalizedUrl]);
    if (urlMatch) {
      return buildExistingMatchWithReaders(urlMatch, "canonical_url", {
        getApplication: getReadOnlyApplicationForJob,
        getLatestReview: (jobId) => getLatestReviewForJobWithGet(getReadOnly, jobId),
      });
    }
  }

  if (title && company) {
    const targetCompany = normalizeForMatch(company);
    const targetTitle = normalizeForMatch(title);
    const candidates = allReadOnly(`SELECT * FROM jobs WHERE lower(company) = lower(?)`, [company]);

    const normalizedMatch = candidates.find((candidate) => {
      return (
        normalizeForMatch(candidate.company) === targetCompany &&
        normalizeForMatch(candidate.title) === targetTitle
      );
    });

    if (normalizedMatch) {
      return buildExistingMatchWithReaders(normalizedMatch, "normalized_company_title", {
        getApplication: getReadOnlyApplicationForJob,
        getLatestReview: (jobId) => getLatestReviewForJobWithGet(getReadOnly, jobId),
      });
    }
  }

  return null;
}

export function initDb() {
  if (initialized) return;
  ensureSchema();
  initialized = true;
}

export function getDashboardData() {
  initDb();
  const rows = all(`
    SELECT
      j.id,
      j.title,
      j.company,
      j.platform,
      j.location,
      j.work_mode AS workMode,
      j.employment_type AS employmentType,
      j.salary_text AS salaryText,
      j.canonical_url AS canonicalUrl,
      j.description_summary AS descriptionSummary,
      a.status AS applicationStatus,
      a.applied_at AS appliedAt,
      a.notes AS applicationNotes,
      r.bucket,
      r.fit_assessment AS fitAssessment,
      r.risk_note AS riskNote,
      r.legitimacy_note AS legitimacyNote
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    LEFT JOIN reviews r ON r.id = (
      SELECT r2.id
      FROM reviews r2
      WHERE r2.job_id = j.id
      ORDER BY r2.created_at DESC, r2.id DESC
      LIMIT 1
    )
    ORDER BY
      CASE COALESCE(r.bucket, 'skip')
        WHEN 'recommend' THEN 0
        WHEN 'borderline' THEN 1
        ELSE 2
      END,
      j.company,
      j.title
  `);

  const grouped = {
    recommend: [],
    borderline: [],
    skip: [],
  };

  for (const row of rows) {
    grouped[row.bucket || "skip"]?.push(row);
  }

  const timelineSources = readTimelineSourceRows();

  return {
    grouped,
    counts: {
      total: rows.length,
      recommend: grouped.recommend.length,
      borderline: grouped.borderline.length,
      skip: grouped.skip.length,
      applied: rows.filter((row) => row.applicationStatus === "applied").length,
    },
    generatedAt: new Date().toISOString(),
    timeline: buildTimelineEvents({
      ...timelineSources,
      limit: 20,
    }),
  };
}

export function getTimelineData({ days = 7, offset = 0 } = {}) {
  initDb();
  const timelineSources = readTimelineSourceRows();
  const allEvents = buildTimelineEvents({
    ...timelineSources,
    limit: null,
  });
  const window = buildTimelineWindow({
    events: allEvents,
    days,
    offset,
  });

  return {
    generatedAt: new Date().toISOString(),
    view: {
      days: window.days,
      offset: window.offset,
      startDate: window.startDate,
      endDate: window.endDate,
      hasOlder: window.hasOlder,
      hasNewer: window.hasNewer,
    },
    counts: window.counts,
    dayEntries: window.dayEntries,
  };
}

function summarizeImportedBuckets(jobs = []) {
  return jobs.reduce(
    (counts, job) => {
      const bucket = job.bucket || "recommend";
      if (bucket === "recommend") counts.importedRecommend += 1;
      else if (bucket === "borderline") counts.importedBorderline += 1;
      else counts.importedSkip += 1;
      return counts;
    },
    {
      importedRecommend: 0,
      importedBorderline: 0,
      importedSkip: 0,
    },
  );
}

function parseSearchRunRow(row) {
  const snapshotInfo = loadRunSnapshot(row.id, row.snapshot_path || "");
  const snapshot = snapshotInfo.snapshot;
  const blockedSources =
    safeJsonParse(row.blocked_sources_json, []).length > 0
      ? safeJsonParse(row.blocked_sources_json, [])
      : snapshot?.results?.blockedSources || snapshot?.payload?.blockedSources || [];
  const importSummaryFromDb = safeJsonParse(row.import_summary_json, {});
  const importSummary =
    Object.keys(importSummaryFromDb).length > 0 ? importSummaryFromDb : buildImportSummaryFromSnapshot(snapshot);
  const funnel = safeJsonParse(row.funnel_json, {});
  const laneReviews = safeJsonParse(row.lane_reviews_json, []);
  const workflowIssues = safeJsonParse(row.workflow_issues_json, []);
  const nextRunAdjustments = safeJsonParse(row.next_run_adjustments_json, []);
  const coverLetterSummary = safeJsonParse(row.cover_letter_summary_json, {});

  return {
    id: row.id,
    searchedAt: row.searched_at,
    promptVersion: row.prompt_version || "",
    platforms: row.platforms || "",
    summary: row.summary || "",
    runQuality: row.run_quality || "",
    promptUpdated: Boolean(row.prompt_updated),
    blockedSources,
    importSummary,
    funnel,
    laneReviews,
    workflowIssues,
    nextRunAdjustments,
    coverLetterSummary,
    snapshotPath: snapshotInfo.snapshotPath || row.snapshot_path || "",
    createdAt: row.created_at,
  };
}

const processFunnelStages = [
  {
    key: "rawHarvested",
    label: "Harvested",
    aliases: ["rawHarvested", "harvested", "rawCandidatesHarvested"],
  },
  {
    key: "uniqueAfterCheapDedupe",
    label: "Unique",
    aliases: ["uniqueAfterCheapDedupe", "uniqueCandidatesAfterCheapDedupe", "uniqueCandidates"],
  },
  {
    key: "batchPreverified",
    label: "Batch Checked",
    aliases: ["batchPreverified", "batchPreverifiedCandidates", "batchPreverifiedCount"],
  },
  {
    key: "livePagesVerified",
    label: "Live Verified",
    aliases: ["livePagesVerified", "browserVerified", "browserFinalVerified"],
  },
  {
    key: "imported",
    label: "Imported",
    aliases: ["imported", "importedTotal"],
  },
];

const processStatusOrder = ["not_started", "ready_to_apply", "applied", "interview", "rejected", "closed", "skipped"];
const processBucketOrder = ["recommend", "borderline", "skip"];

function numberFromAliases(source, aliases) {
  for (const alias of aliases) {
    const value = Number(source?.[alias]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function importedTotalForRun(run) {
  const funnel = run.funnel || {};
  const importSummary = run.importSummary || {};
  const explicit = numberFromAliases(funnel, ["imported", "importedTotal"]);
  if (explicit) return explicit;
  return (
    Number(funnel.importedRecommend ?? importSummary.importedRecommend ?? 0) +
    Number(funnel.importedBorderline ?? importSummary.importedBorderline ?? 0) +
    Number(funnel.importedSkip ?? importSummary.importedSkip ?? 0)
  );
}

function buildProcessSummary(runs) {
  const latestRun = runs[0] || null;
  const aggregateFunnel = processFunnelStages.map((stage) => {
    const total = runs.reduce((sum, run) => {
      if (stage.key === "imported") return sum + importedTotalForRun(run);
      return sum + numberFromAliases(run.funnel || {}, stage.aliases);
    }, 0);
    const latest =
      stage.key === "imported"
        ? importedTotalForRun(latestRun || {})
        : numberFromAliases(latestRun?.funnel || {}, stage.aliases);

    return {
      key: stage.key,
      label: stage.label,
      total,
      latest,
    };
  });

  const applicationRows = all(`
    SELECT
      COALESCE(NULLIF(j.platform, ''), 'Unknown') AS platform,
      COALESCE(NULLIF(a.status, ''), 'not_started') AS status,
      COALESCE(NULLIF(r.bucket, ''), 'skip') AS bucket,
      COUNT(*) AS count
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    LEFT JOIN reviews r ON r.id = (
      SELECT r2.id
      FROM reviews r2
      WHERE r2.job_id = j.id
      ORDER BY r2.created_at DESC, r2.id DESC
      LIMIT 1
    )
    GROUP BY platform, status, bucket
  `);

  const sourceMap = new Map();
  const bucketStatusMap = new Map();
  const statusTotals = new Map();
  const bucketTotals = new Map();

  for (const row of applicationRows) {
    const count = Number(row.count || 0);
    const platform = row.platform || "Unknown";
    const status = row.status || "not_started";
    const bucket = row.bucket || "skip";

    if (!sourceMap.has(platform)) {
      sourceMap.set(platform, { platform, total: 0, statuses: {} });
    }
    const source = sourceMap.get(platform);
    source.total += count;
    source.statuses[status] = (source.statuses[status] || 0) + count;

    const bucketStatusKey = `${bucket}:${status}`;
    bucketStatusMap.set(bucketStatusKey, {
      bucket,
      status,
      count: (bucketStatusMap.get(bucketStatusKey)?.count || 0) + count,
    });
    statusTotals.set(status, (statusTotals.get(status) || 0) + count);
    bucketTotals.set(bucket, (bucketTotals.get(bucket) || 0) + count);
  }

  return {
    funnel: aggregateFunnel,
    sourceOutcomes: Array.from(sourceMap.values()).sort((left, right) => right.total - left.total || left.platform.localeCompare(right.platform)),
    bucketStatusFlows: Array.from(bucketStatusMap.values()).sort((left, right) => {
      const bucketDelta = processBucketOrder.indexOf(left.bucket) - processBucketOrder.indexOf(right.bucket);
      if (bucketDelta !== 0) return bucketDelta;
      return processStatusOrder.indexOf(left.status) - processStatusOrder.indexOf(right.status);
    }),
    statusTotals: Object.fromEntries(statusTotals),
    bucketTotals: Object.fromEntries(bucketTotals),
    statusOrder: processStatusOrder,
    bucketOrder: processBucketOrder,
    totalJobs: applicationRows.reduce((sum, row) => sum + Number(row.count || 0), 0),
  };
}

export function getWorkflowRunsData({ limit = 24 } = {}) {
  initDb();
  const normalizedLimit = Math.max(1, Math.min(60, Number(limit) || 24));
  const rows = all(
    `SELECT *
     FROM search_runs
     ORDER BY datetime(searched_at) DESC, id DESC
     LIMIT ?`,
    [normalizedLimit],
  );

  const runs = rows.map(parseSearchRunRow);
  const counts = {
    total: runs.length,
    good: runs.filter((run) => run.runQuality === "good").length,
    mixed: runs.filter((run) => run.runQuality === "mixed").length,
    degraded: runs.filter((run) => run.runQuality === "degraded").length,
    promptUpdated: runs.filter((run) => run.promptUpdated).length,
  };

  const trends = runs
    .slice()
    .reverse()
    .map((run) => ({
      id: run.id,
      label: new Intl.DateTimeFormat("en-AU", {
        month: "short",
        day: "numeric",
      }).format(new Date(run.searchedAt || run.createdAt)),
      importedRecommend: Number(run.funnel.importedRecommend ?? run.importSummary.importedRecommend ?? 0),
      rawHarvested: Number(run.funnel.rawHarvested ?? 0),
      blockedSources: Array.isArray(run.blockedSources) ? run.blockedSources.length : 0,
      quality: run.runQuality || "unknown",
    }));

  return {
    generatedAt: new Date().toISOString(),
    counts,
    trends,
    processSummary: buildProcessSummary(runs),
    runs,
  };
}

function normalizeLanePerformanceKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nonnegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function laneBlockedCount(lane) {
  const explicit = nonnegativeNumber(lane.blockedCount);
  if (explicit) return explicit;
  if (Array.isArray(lane.blockedSources)) return lane.blockedSources.length;
  return lane.finishedCleanly === false ? 1 : 0;
}

function laneReviewCount(lane, aliases) {
  return nonnegativeNumber(numberFromAliases(lane, aliases));
}

function ensureLanePerformanceStats(statsByKey, key, lane) {
  if (!statsByKey.has(key)) {
    statsByKey.set(key, {
      laneKey: key,
      laneId: lane.laneId || "",
      lane: lane.lane || lane.laneId || key,
      source: lane.source || "",
      aliases: new Set([key]),
      runs: 0,
      lastSearchedAt: "",
      recentRecommendCount: 0,
      recentBorderlineCount: 0,
      rawCandidates: 0,
      stableUrlsCaptured: 0,
      candidatesReturned: 0,
      blockedCount: 0,
      terminalDuplicateCount: 0,
      outcomes: [],
    });
  }

  return statsByKey.get(key);
}

function suggestedLaneStatus(stats, score, zeroRecommendStreak) {
  if (zeroRecommendStreak >= 4 && score <= 0) return "archived";
  if (zeroRecommendStreak >= 2 && score <= 0) return "cooldown";
  if (stats.runs <= 1) return "explore";
  return "active";
}

export function getLanePerformanceData({ limit = 7 } = {}) {
  initDb();
  const normalizedLimit = Math.max(1, Math.min(30, Number(limit) || 7));
  const rows = all(
    `SELECT *
     FROM search_runs
     WHERE lane_reviews_json IS NOT NULL
       AND lane_reviews_json != '[]'
     ORDER BY datetime(searched_at) DESC, id DESC
     LIMIT ?`,
    [normalizedLimit],
  );
  const runs = rows.map(parseSearchRunRow);
  const statsByKey = new Map();

  for (const run of runs) {
    for (const lane of run.laneReviews || []) {
      const laneKey = normalizeLanePerformanceKey(lane.laneId || lane.lane);
      if (!laneKey) continue;

      const stats = ensureLanePerformanceStats(statsByKey, laneKey, lane);
      const aliases = [lane.laneId, lane.lane, `${lane.source || ""}:${lane.laneId || lane.lane || ""}`]
        .map(normalizeLanePerformanceKey)
        .filter(Boolean);
      for (const alias of aliases) stats.aliases.add(alias);

      if (!stats.laneId && lane.laneId) stats.laneId = lane.laneId;
      if (!stats.source && lane.source) stats.source = lane.source;
      if (!stats.lastSearchedAt) stats.lastSearchedAt = run.searchedAt || run.createdAt || "";

      const recommendCount = laneReviewCount(lane, ["recommendCount", "importedRecommend", "recommended"]);
      const borderlineCount = laneReviewCount(lane, ["borderlineCount", "importedBorderline"]);
      const rawCandidates = laneReviewCount(lane, ["rawCandidates", "rawHarvested"]);
      const stableUrlsCaptured = laneReviewCount(lane, ["stableUrlsCaptured"]);
      const candidatesReturned = laneReviewCount(lane, ["candidatesReturned"]);
      const blockedCount = laneBlockedCount(lane);
      const terminalDuplicateCount = laneReviewCount(lane, [
        "terminalDuplicateCount",
        "excludedTerminalDuplicates",
        "terminalDuplicates",
      ]);

      stats.runs += 1;
      stats.recentRecommendCount += recommendCount;
      stats.recentBorderlineCount += borderlineCount;
      stats.rawCandidates += rawCandidates;
      stats.stableUrlsCaptured += stableUrlsCaptured;
      stats.candidatesReturned += candidatesReturned;
      stats.blockedCount += blockedCount;
      stats.terminalDuplicateCount += terminalDuplicateCount;
      stats.outcomes.push({
        searchedAt: run.searchedAt || run.createdAt || "",
        recommendCount,
      });
    }
  }

  const lanes = Array.from(statsByKey.values()).map((stats) => {
    let zeroRecommendStreak = 0;
    for (const outcome of stats.outcomes) {
      if (outcome.recommendCount > 0) break;
      zeroRecommendStreak += 1;
    }

    const score =
      4 * stats.recentRecommendCount +
      2 * stats.recentBorderlineCount +
      stats.stableUrlsCaptured -
      2 * stats.terminalDuplicateCount -
      3 * stats.blockedCount -
      2 * zeroRecommendStreak;

    const { outcomes, aliases, ...publicStats } = stats;
    void outcomes;

    return {
      ...publicStats,
      aliases: Array.from(aliases).sort(),
      zeroRecommendStreak,
      score,
      suggestedStatus: suggestedLaneStatus(stats, score, zeroRecommendStreak),
    };
  });

  lanes.sort((left, right) => {
    const scoreDelta = right.score - left.score;
    if (scoreDelta !== 0) return scoreDelta;
    return left.lane.localeCompare(right.lane);
  });

  return {
    generatedAt: new Date().toISOString(),
    windowRuns: runs.length,
    limit: normalizedLimit,
    lanes,
  };
}

export function getJobDetail(jobId) {
  initDb();
  const job = get(
    `SELECT
      j.*,
      a.status AS applicationStatus,
      a.applied_at AS appliedAt,
      a.notes AS applicationNotes,
      a.checklist_json AS checklistJson,
      a.updated_at AS applicationUpdatedAt
     FROM jobs j
     LEFT JOIN applications a ON a.job_id = j.id
     WHERE j.id = ?`,
    [jobId],
  );

  if (!job) return null;

  const reviews = all(
    `SELECT * FROM reviews WHERE job_id = ? ORDER BY created_at DESC, id DESC`,
    [jobId],
  );
  const documents = all(
    `SELECT * FROM documents WHERE job_id = ? ORDER BY created_at DESC, id DESC`,
    [jobId],
  );
  const timeline = buildTimelineEvents({
    jobRows: [
      {
        jobId: job.id,
        title: job.title,
        company: job.company,
        canonicalUrl: job.canonical_url,
        jobCreatedAt: job.created_at,
        status: job.applicationStatus,
        appliedAt: job.appliedAt,
        notes: job.applicationNotes,
        applicationUpdatedAt: job.applicationUpdatedAt,
        bucket: reviews[0]?.bucket || "skip",
        reviewCreatedAt: reviews[0]?.created_at || null,
      },
    ],
    documentRows: documents
      .filter((item) => item.kind === "cover_letter")
      .map((item) => ({
        jobId: job.id,
        format: item.format,
        filePath: item.file_path,
        createdAt: item.created_at,
      })),
    reviewRows: reviews.map((item) => ({
      jobId,
      title: job.title,
      company: job.company,
      canonicalUrl: job.canonical_url,
      bucket: item.bucket,
      fitAssessment: item.fit_assessment,
      riskNote: item.risk_note,
      legitimacyNote: item.legitimacy_note,
      createdAt: item.created_at,
    })),
    limit: 12,
  });

  return { ...job, reviews, documents, timeline };
}

export function storeCoverLetterAssets({ jobId, textFilePath, pdfFilePath }) {
  initDb();

  const job = get(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!textFilePath || !fileExists(textFilePath)) {
    throw new Error("A readable text file is required to store a cover letter.");
  }

  const textContent = fs.readFileSync(textFilePath, "utf8");
  replaceDocument(jobId, "cover_letter", "text", "Cover letter text", textFilePath, textContent);

  if (pdfFilePath) {
    if (!fileExists(pdfFilePath)) {
      throw new Error(`PDF file not found: ${pdfFilePath}`);
    }
    replaceDocument(jobId, "cover_letter", "pdf", "Cover letter PDF", pdfFilePath, null);
  }

  return getJobDetail(jobId);
}

export function lookupJob(payload) {
  const match = findExistingJobMatch(payload);

  return {
    found: Boolean(match),
    match,
    shouldExcludeFromRecommendations: Boolean(match?.isTerminal),
  };
}

export function lookupJobsBatch(payloads = []) {
  const items = Array.isArray(payloads) ? payloads : [];

  return items.map((payload, index) => {
    const canonicalUrl = payload?.canonicalUrl || payload?.postingUrl || payload?.url || null;
    const match = findExistingJobMatchReadOnly({
      canonicalUrl,
      title: payload?.title || "",
      company: payload?.company || "",
    });

    return {
      sourceId: payload?.sourceId || String(index + 1),
      title: payload?.title || "",
      company: payload?.company || "",
      canonicalUrl: normalizeLookupCanonicalUrl(canonicalUrl) || "",
      found: Boolean(match),
      match,
      shouldExcludeFromRecommendations: Boolean(match?.isTerminal),
    };
  });
}

export function upsertApplication(jobId, payload) {
  initDb();
  const existing = get("SELECT * FROM applications WHERE job_id = ?", [jobId]);

  if (existing) {
    run(
      `UPDATE applications
       SET status = ?, applied_at = ?, notes = ?, checklist_json = ?, updated_at = ?
       WHERE job_id = ?`,
      [
        payload.status ?? existing.status,
        payload.appliedAt ?? existing.applied_at,
        payload.notes ?? existing.notes,
        payload.checklistJson ?? existing.checklist_json,
        new Date().toISOString(),
        jobId,
      ],
    );
  } else {
    run(
      `INSERT INTO applications (job_id, status, applied_at, notes, checklist_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        payload.status || "not_started",
        payload.appliedAt || null,
        payload.notes || "",
        payload.checklistJson || "{}",
        new Date().toISOString(),
      ],
    );
  }

  return getJobDetail(jobId);
}

export function createManualJob(payload) {
  initDb();

  const result = run(
    `INSERT INTO jobs (
      canonical_url, title, company, platform, location, work_mode, employment_type,
      salary_text, source_quality, description_summary, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.canonicalUrl,
      payload.title,
      payload.company,
      payload.platform || "Manual",
      payload.location || "",
      payload.workMode || "",
      payload.employmentType || "",
      payload.salaryText || "",
      payload.sourceQuality || "manual",
      payload.descriptionSummary || "",
      new Date().toISOString(),
    ],
  );

  const jobId = Number(result.lastInsertRowid);

  run(
    `INSERT INTO reviews (job_id, bucket, fit_assessment, risk_note, legitimacy_note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      jobId,
      payload.bucket || "recommend",
      payload.fitAssessment || "",
      payload.riskNote || "",
      payload.legitimacyNote || "",
    ],
  );

  run(
    `INSERT INTO applications (job_id, status, notes, updated_at)
     VALUES (?, ?, ?, ?)`,
    [jobId, payload.applicationStatus || "not_started", payload.applicationNotes || "", new Date().toISOString()],
  );

  return getJobDetail(jobId);
}

export function captureLead(payload) {
  const jobResult = upsertJobRecord({
    ...payload,
    defaultSourceQuality: "manual_lead",
  });
  const notes =
    payload.applicationNotes ||
    compactNotes([
      payload.whyGoodFit ? `Why pursue: ${payload.whyGoodFit}` : "",
      payload.stoppedBecause ? `Agent stopped: ${payload.stoppedBecause}` : "",
      payload.nextAction ? `Next action: ${payload.nextAction}` : "",
    ]);

  const reviewId = insertReview(jobResult.jobId, payload, payload.bucket || "recommend");
  const detail = upsertApplication(jobResult.jobId, {
    status: payload.applicationStatus || "ready_to_apply",
    notes,
    checklistJson: checklistToJson(payload.checklist),
  });

  return {
    action: "capture-lead",
    jobId: jobResult.jobId,
    created: jobResult.created,
    matchType: jobResult.matchType,
    reviewId,
    status: detail.applicationStatus,
    detail,
  };
}

export function logApplicationOutcome(payload) {
  const jobResult = upsertJobRecord(payload);
  const reviewId =
    payload.bucket || payload.fitAssessment || payload.riskNote || payload.legitimacyNote
      ? insertReview(jobResult.jobId, payload, payload.bucket || "recommend")
      : null;
  const notes = payload.applicationNotes || payload.evidenceNote || "";
  const detail = upsertApplication(jobResult.jobId, {
    status: "applied",
    appliedAt: payload.appliedAt || todayString(),
    notes,
    checklistJson: checklistToJson(payload.checklist),
  });

  return {
    action: "log-application",
    jobId: jobResult.jobId,
    created: jobResult.created,
    matchType: jobResult.matchType,
    reviewId,
    status: detail.applicationStatus,
    appliedAt: detail.appliedAt || payload.appliedAt || todayString(),
    detail,
  };
}

export function updateJobStatus(payload) {
  initDb();
  const jobId = resolveJobIdFromLocator(payload);
  const detail = upsertApplication(jobId, {
    status: payload.status,
    appliedAt: payload.appliedAt ?? (payload.status === "applied" ? todayString() : undefined),
    notes: payload.notes,
    checklistJson: checklistToJson(payload.checklist),
  });

  return {
    action: "update-job-status",
    jobId,
    status: detail.applicationStatus,
    appliedAt: detail.appliedAt || null,
    detail,
  };
}

export function importShortlist(payload) {
  initDb();
  const initialImportSummary = {
    received: (payload.jobs || []).length,
    created: 0,
    updated: 0,
    excludedExisting: 0,
    ...summarizeImportedBuckets(payload.jobs || []),
  };
  const runResult = run(
    `INSERT INTO search_runs (
      searched_at, prompt_version, platforms, summary, blocked_sources_json, import_summary_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.searchedAt || new Date().toISOString(),
      payload.promptVersion || "",
      (payload.platforms || []).join(", "),
      payload.summary || "",
      JSON.stringify(payload.blockedSources || []),
      JSON.stringify(initialImportSummary),
    ],
  );

  const runId = Number(runResult.lastInsertRowid);
  const results = {
    runId,
    searchedAt: payload.searchedAt || new Date().toISOString(),
    summary: payload.summary || "",
    blockedSources: payload.blockedSources || [],
    counts: {
      received: (payload.jobs || []).length,
      created: 0,
      updated: 0,
      excludedExisting: 0,
    },
    created: [],
    updated: [],
    excludedExisting: [],
  };

  for (const item of payload.jobs || []) {
    const existingMatch = findExistingJobMatch({
      canonicalUrl: item.canonicalUrl,
      title: item.title,
      company: item.company,
    });

    if (existingMatch?.isTerminal) {
      results.counts.excludedExisting += 1;
      results.excludedExisting.push({
        ...existingMatch,
        reason: `Existing ${existingMatch.applicationStatus} role`,
      });
      continue;
    }

    let job = get("SELECT * FROM jobs WHERE id = ?", [existingMatch?.jobId || -1]) ||
      get("SELECT * FROM jobs WHERE canonical_url = ?", [item.canonicalUrl]);
    let jobId = job?.id;

    if (job) {
      run(
        `UPDATE jobs
         SET title = ?, company = ?, platform = ?, location = ?, work_mode = ?, employment_type = ?,
             salary_text = ?, source_quality = ?, description_summary = ?, updated_at = ?
         WHERE id = ?`,
        [
          item.title,
          item.company,
          item.platform || job.platform,
          item.location || job.location,
          item.workMode || job.work_mode,
          item.employmentType || job.employment_type,
          item.salaryText || job.salary_text,
          item.sourceQuality || job.source_quality,
          item.descriptionSummary || job.description_summary,
          new Date().toISOString(),
          job.id,
        ],
      );
      results.counts.updated += 1;
      results.updated.push({
        jobId: job.id,
        canonicalUrl: item.canonicalUrl,
        title: item.title,
        company: item.company,
        matchType: existingMatch?.matchType || "canonical_url",
      });
    } else {
      const insertJob = run(
        `INSERT INTO jobs (
          canonical_url, title, company, platform, location, work_mode, employment_type,
          salary_text, source_quality, description_summary, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.canonicalUrl,
          item.title,
          item.company,
          item.platform || "",
          item.location || "",
          item.workMode || "",
          item.employmentType || "",
          item.salaryText || "",
          item.sourceQuality || "",
          item.descriptionSummary || "",
          new Date().toISOString(),
        ],
      );
      jobId = Number(insertJob.lastInsertRowid);
      run(
        `INSERT INTO applications (job_id, status, updated_at) VALUES (?, ?, ?)`,
        [jobId, "not_started", new Date().toISOString()],
      );
      results.counts.created += 1;
      results.created.push({
        jobId,
        canonicalUrl: item.canonicalUrl,
        title: item.title,
        company: item.company,
      });
    }

    run(
      `INSERT INTO reviews (job_id, run_id, bucket, fit_assessment, risk_note, legitimacy_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        jobId || job.id,
        runId,
        item.bucket || "recommend",
        item.fitAssessment || "",
        item.riskNote || "",
        item.legitimacyNote || "",
      ],
    );
  }

  const snapshotPath = snapshotFilePathForRun(runId, results.searchedAt);
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        importedAt: new Date().toISOString(),
        payload,
        results: {
          runId: results.runId,
          searchedAt: results.searchedAt,
          summary: results.summary,
          blockedSources: results.blockedSources,
          counts: results.counts,
          created: results.created,
          updated: results.updated,
          excludedExisting: results.excludedExisting,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  run(
    `UPDATE search_runs
     SET import_summary_json = ?, snapshot_path = ?
     WHERE id = ?`,
    [
      JSON.stringify({
        received: results.counts.received,
        created: results.counts.created,
        updated: results.counts.updated,
        excludedExisting: results.counts.excludedExisting,
        ...summarizeImportedBuckets(payload.jobs || []),
      }),
      snapshotPath,
      runId,
    ],
  );

  return {
    ...results,
    snapshotPath,
    dashboard: getDashboardData(),
  };
}

export function finalizeSearchRun(payload) {
  initDb();
  const existing = get(`SELECT * FROM search_runs WHERE id = ?`, [payload.runId]);
  if (!existing) {
    throw new Error(`Search run not found: ${payload.runId}`);
  }

  const current = parseSearchRunRow(existing);
  run(
    `UPDATE search_runs
     SET prompt_version = ?,
         run_quality = ?,
         prompt_updated = ?,
         funnel_json = ?,
         lane_reviews_json = ?,
         workflow_issues_json = ?,
         next_run_adjustments_json = ?,
         cover_letter_summary_json = ?
     WHERE id = ?`,
    [
      payload.promptVersion || current.promptVersion || "",
      payload.runQuality || current.runQuality || "",
      payload.promptUpdated === undefined ? (current.promptUpdated ? 1 : 0) : payload.promptUpdated ? 1 : 0,
      JSON.stringify(payload.funnel || current.funnel || {}),
      JSON.stringify(payload.laneReviews || current.laneReviews || []),
      JSON.stringify(payload.workflowIssues || current.workflowIssues || []),
      JSON.stringify(payload.nextRunAdjustments || current.nextRunAdjustments || []),
      JSON.stringify(payload.coverLetterSummary || current.coverLetterSummary || {}),
      payload.runId,
    ],
  );

  const updated = get(`SELECT * FROM search_runs WHERE id = ?`, [payload.runId]);
  return parseSearchRunRow(updated);
}

export function exportAppliedJobsSnapshot() {
  initDb();
  const rows = all(`
    SELECT
      j.title,
      j.company,
      j.platform,
      j.canonical_url AS canonicalUrl,
      j.location,
      j.work_mode AS workMode,
      a.status,
      a.applied_at AS appliedAt,
      a.notes
    FROM jobs j
    JOIN applications a ON a.job_id = j.id
    WHERE a.status = 'applied'
    ORDER BY COALESCE(a.applied_at, ''), j.company, j.title
  `);

  const lines = [
    "# Applied Jobs Snapshot",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
  ];

  for (const row of rows) {
    lines.push(`## ${row.title} — ${row.company}`);
    lines.push(`- Company: ${row.company}`);
    lines.push(`- Source: ${row.platform || ""}`);
    lines.push(`- URL: ${row.canonicalUrl}`);
    lines.push(`- Location: ${row.location || ""}`);
    lines.push(`- Work mode: ${row.workMode || ""}`);
    lines.push(`- Application status: ${row.status}`);
    lines.push(`- Applied date: ${row.appliedAt || "Not recorded"}`);
    lines.push(`- Notes: ${row.notes || ""}`);
    lines.push("");
  }

  return lines.join("\n");
}
