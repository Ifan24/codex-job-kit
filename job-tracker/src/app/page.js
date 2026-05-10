"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BriefcaseBusiness,
  CircleAlert,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Hourglass,
  ListTodo,
  MessageSquareMore,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import TrackerNav from "@/components/TrackerNav";
import { buildCoverLetterPrompt } from "@/lib/cover-letter-prompt";
import { bucketLabels, statusLabels } from "@/lib/statuses";

const queueHiddenStatuses = new Set(["applied", "interview", "skipped", "rejected", "closed"]);
const emptyDashboard = {
  grouped: {
    recommend: [],
    borderline: [],
    skip: [],
  },
  counts: {
    total: 0,
    recommend: 0,
    borderline: 0,
    skip: 0,
    applied: 0,
  },
  blockedSources: [],
  recentRuns: [],
  timeline: [],
  generatedAt: null,
};

async function readJsonResponse(response, fallbackMessage) {
  const rawText = await response.text();

  if (!rawText) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(fallbackMessage);
  }
}

function sortJobsForAction(jobs) {
  const statusRank = {
    ready_to_apply: 0,
    not_started: 1,
    skipped: 2,
    applied: 3,
    interview: 4,
    rejected: 5,
    closed: 6,
  };

  const bucketRank = {
    recommend: 0,
    borderline: 1,
    skip: 2,
  };

  return [...jobs].sort((left, right) => {
    const statusDelta =
      (statusRank[left.applicationStatus || "not_started"] ?? 9) -
      (statusRank[right.applicationStatus || "not_started"] ?? 9);
    if (statusDelta !== 0) return statusDelta;

    const bucketDelta = (bucketRank[left.bucket || "skip"] ?? 9) - (bucketRank[right.bucket || "skip"] ?? 9);
    if (bucketDelta !== 0) return bucketDelta;

    return `${left.company} ${left.title}`.localeCompare(`${right.company} ${right.title}`);
  });
}

function sortVisibleJobs(jobs, sortMode) {
  if (sortMode === "company") {
    return [...jobs].sort((left, right) =>
      `${left.company} ${left.title}`.localeCompare(`${right.company} ${right.title}`),
    );
  }

  if (sortMode === "location") {
    return [...jobs].sort((left, right) =>
      `${left.location || ""} ${left.company}`.localeCompare(`${right.location || ""} ${right.company}`),
    );
  }

  return sortJobsForAction(jobs);
}

function matchesJobFilters(job, { searchText, bucketFilter, sourceFilter, modeFilter }) {
  const query = searchText.trim().toLowerCase();
  const bucket = job.bucket || "skip";
  const source = String(job.platform || "").toLowerCase();
  const workMode = String(job.workMode || job.work_mode || "").toLowerCase();
  const location = String(job.location || "").toLowerCase();
  const status = String(job.applicationStatus || "not_started").toLowerCase();
  const haystack = [
    job.title,
    job.company,
    job.location,
    job.fitAssessment,
    job.descriptionSummary,
    job.applicationNotes,
    statusLabels[job.applicationStatus || "not_started"],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (query && !haystack.includes(query)) return false;
  if (bucketFilter !== "all" && bucket !== bucketFilter) return false;
  if (sourceFilter !== "all" && !source.includes(sourceFilter)) return false;
  if (modeFilter === "remote" && !workMode.includes("remote")) return false;
  if (modeFilter === "hybrid" && !workMode.includes("hybrid")) return false;
  if (modeFilter === "onsite" && !(workMode.includes("on-site") || workMode.includes("onsite"))) return false;
  if (modeFilter === "sydney" && !location.includes("sydney")) return false;

  return true;
}

function resolveSelectedJobId(data, preferredSelectedJobId) {
  const allRows = sortJobsForAction([
    ...(data.grouped.recommend || []),
    ...(data.grouped.borderline || []),
    ...(data.grouped.skip || []),
  ]);

  if (
    preferredSelectedJobId &&
    allRows.some(
      (job) =>
        job.id === preferredSelectedJobId &&
        !queueHiddenStatuses.has(job.applicationStatus || "not_started"),
    )
  ) {
    return preferredSelectedJobId;
  }

  const nextCandidate =
    allRows.find((job) => !queueHiddenStatuses.has(job.applicationStatus || "not_started")) || null;

  return nextCandidate?.id ?? null;
}

function StatCard({ label, value, tone, hint }) {
  return (
    <div className={`stat-pill stat-${tone}`}>
      <div>
        <div className="stat-pill-label">{label}</div>
        {hint ? <div className="stat-pill-hint">{hint}</div> : null}
      </div>
      <div className="stat-pill-value">{value}</div>
    </div>
  );
}

function StatePanel({ icon: Icon, kicker, title, description, actionLabel, onAction }) {
  return (
    <section className="state-panel">
      <div className="state-panel-icon">
        <Icon size={20} />
      </div>
      <div className="state-panel-copy">
        <div className="state-panel-kicker">{kicker}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="secondary-button" onClick={onAction}>
          <RefreshCw size={16} />
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function JobCard({ job, active, onSelect, mode }) {
  const status = job.applicationStatus || "not_started";
  const bucket = job.bucket || "skip";

  return (
    <button type="button" className={`job-card ${active ? "is-active" : ""}`} onClick={() => onSelect(job.id)}>
      <div className="job-card-kicker">
        <span className="job-company">{job.company}</span>
        <span className="job-source">{job.platform || "Unknown"}</span>
      </div>
      <div className="job-title-row">
        <div className="job-title">{job.title}</div>
        <span className={`status-pill status-${status}`}>{statusLabels[status]}</span>
      </div>
      <div className="job-meta-grid">
        <span className="job-detail-pill">{job.location || "Location pending"}</span>
        <span className="job-detail-pill">{job.workMode || "Mode not set"}</span>
      </div>
      <p className="job-note">{job.fitAssessment || job.descriptionSummary || "No notes yet."}</p>
      <div className="job-card-bottom">
        <span className={`bucket-pill bucket-${bucket}`}>{bucketLabels[bucket]}</span>
        <span className="job-mode-note">{mode}</span>
      </div>
    </button>
  );
}

function PipelineCard({ job, active, onSelect }) {
  return (
    <button type="button" className={`pipeline-card ${active ? "is-active" : ""}`} onClick={() => onSelect(job.id)}>
      <div className="pipeline-top">
        <span className="job-company">{job.company}</span>
        <span className={`status-pill status-${job.applicationStatus || "not_started"}`}>
          {statusLabels[job.applicationStatus || "not_started"]}
        </span>
      </div>
      <div className="pipeline-title">{job.title}</div>
      <div className="pipeline-meta">
        <span>{job.location || "Location pending"}</span>
        {job.appliedAt ? <span>Applied {job.appliedAt}</span> : null}
      </div>
    </button>
  );
}

function QueueSection({ icon: Icon, title, subtitle, jobs, activeJobId, onSelect, mode }) {
  return (
    <section className="queue-section">
      <div className="queue-section-header">
        <div className="section-titleline">
          <Icon size={16} />
          <h2>{title}</h2>
        </div>
        <span className="queue-header-meta">{subtitle}</span>
      </div>
      {jobs.length ? (
        <div className="queue-list">
          {jobs.map((job) => (
            <JobCard
              key={`${title}-${job.id}`}
              job={job}
              active={activeJobId === job.id}
              onSelect={onSelect}
              mode={mode}
            />
          ))}
        </div>
      ) : (
        <div className="empty-card compact">Nothing waiting here right now.</div>
      )}
    </section>
  );
}

function QueueFilters({
  searchText,
  onSearchChange,
  bucketFilter,
  onBucketChange,
  sourceFilter,
  onSourceChange,
  modeFilter,
  onModeChange,
  sortMode,
  onSortChange,
  filteredCount,
  totalCount,
  activeFilteredCount,
  activeTotalCount,
  pipelineFilteredCount,
  archiveFilteredCount,
  onReset,
}) {
  return (
    <section className="queue-filters">
      <div className="filter-search">
        <Search size={16} />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search all jobs by title, company, location, note, status..."
          aria-label="Search all jobs"
        />
      </div>
      <div className="filter-stack">
        <div className="filter-line">
          <span className="filter-label">Priority</span>
          {[
            ["all", "All"],
            ["recommend", "Recommend"],
            ["borderline", "Borderline"],
            ["skip", "Skip"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`filter-chip ${bucketFilter === value ? "is-active" : ""}`}
              aria-pressed={bucketFilter === value}
              onClick={() => onBucketChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-line">
          <span className="filter-label">Source</span>
          {[
            ["all", "All sources"],
            ["linkedin", "LinkedIn"],
            ["seek", "SEEK"],
            ["ats", "ATS"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`filter-chip ${sourceFilter === value ? "is-active" : ""}`}
              aria-pressed={sourceFilter === value}
              onClick={() => onSourceChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-line">
          <span className="filter-label">Mode</span>
          {[
            ["all", "All modes"],
            ["remote", "Remote"],
            ["hybrid", "Hybrid"],
            ["onsite", "On-site"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`filter-chip ${modeFilter === value ? "is-active" : ""}`}
              aria-pressed={modeFilter === value}
              onClick={() => onModeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-footer">
        <div className="filter-footer-left">
          <label className="sort-control">
            <span className="filter-label">
              <SlidersHorizontal size={14} />
              Sort
            </span>
            <select value={sortMode} onChange={(event) => onSortChange(event.target.value)}>
              <option value="priority">Priority</option>
              <option value="company">Company</option>
              <option value="location">Location</option>
            </select>
          </label>
          <button type="button" className="secondary-button compact-button" onClick={onReset}>
            Reset filters
          </button>
        </div>
        <div
          className="filter-counts"
          aria-label={`Showing ${activeFilteredCount} of ${activeTotalCount} active roles, ${filteredCount} of ${totalCount} tracked roles`}
        >
          <span className="filter-count-primary">{`${activeFilteredCount} / ${activeTotalCount} active`}</span>
          <span>{`${pipelineFilteredCount} in flight`}</span>
          <span>{`${archiveFilteredCount} archived`}</span>
          <span>{`${filteredCount} / ${totalCount} tracked`}</span>
        </div>
      </div>
    </section>
  );
}

function QueueEmptyState({ onSelectPipeline, hasPipeline }) {
  return (
    <section className="queue-empty">
      <div className="queue-empty-kicker">Queue Clear</div>
      <h2>No active applications need work right now.</h2>
      <p>The daily workflow can keep importing new roles directly. Until then, you can check the pipeline for follow-ups.</p>
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onSelectPipeline} disabled={!hasPipeline}>
          <MessageSquareMore size={16} />
          Jump to pipeline
        </button>
      </div>
    </section>
  );
}

function DetailPanel({ job, onStatusChange, onCopyText, onCopyPrompt, onRevealDocument }) {
  const [notesByJob, setNotesByJob] = useState({});
  const notes = job ? notesByJob[job.id] ?? job.applicationNotes ?? "" : "";

  function setNotes(value) {
    if (!job) return;
    setNotesByJob((current) => ({ ...current, [job.id]: value }));
  }

  if (!job) {
    return (
      <aside className="detail-panel empty-state sticky-panel">
        <div className="empty-card large">Choose a role to open its listing, notes, cover letter, and status actions.</div>
      </aside>
    );
  }

  const latestReview = job.reviews?.[0];
  const coverLetterText = job.documents?.find((item) => item.kind === "cover_letter" && item.format === "text");
  const coverLetterPdf = job.documents?.find((item) => item.kind === "cover_letter" && item.format === "pdf");
  const coverLetterPrompt = buildCoverLetterPrompt({ job, latestReview });
  const status = job.applicationStatus || "not_started";
  const hasRealListing = Boolean(job.canonical_url) && !String(job.canonical_url).startsWith("email://");
  const isArchivedLane = ["skipped", "rejected", "closed"].includes(status);
  const isAppliedLane = ["applied", "interview"].includes(status);
  const hasCoverLetter = Boolean(coverLetterText?.text_content);
  const assessmentSignal =
    latestReview?.fit_assessment || job.fitAssessment || job.description_summary || job.descriptionSummary || "No assessment recorded yet.";

  return (
    <aside className="detail-panel sticky-panel">
      <div className="detail-hero">
        <div className="detail-eyebrow">{job.platform || "Manual source"}</div>
        <h1>{job.title}</h1>
        <div className="detail-company">{job.company}</div>
        <div className="detail-meta">
          <span>{job.location || "Location pending"}</span>
          <span>{job.work_mode || "Mode not set"}</span>
          <span>{job.salary_text || "Salary not listed"}</span>
        </div>
        <div className={`detail-banner detail-role-summary ${isAppliedLane ? "subtle" : ""}`}>
          <div>
            <span className="detail-summary-label">Assessment</span>
            <p>{assessmentSignal}</p>
          </div>
        </div>
      </div>

      <section className="detail-section detail-actions">
        <div className="section-titleline">
          <Sparkles size={16} />
          <h3>Action Hub</h3>
        </div>
        <div className="action-stage-grid">
          <div className="action-stage-card action-stage-submit">
            <div className="action-stage-label">Submit</div>
            <div className="action-stage-actions">
              {hasRealListing ? (
                <a className="primary-button" href={job.canonical_url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  Open listing
                </a>
              ) : (
                <span className="detail-muted-card">
                  <ExternalLink size={16} />
                  No listing URL stored
                </span>
              )}
              <button type="button" className="secondary-button submit-confirm-button" onClick={() => onStatusChange(job.id, "applied", new Date().toISOString().slice(0, 10), notes)}>
                <Send size={16} />
                Mark applied
              </button>
              <p className="action-stage-hint">Use after submitting on the external listing.</p>
            </div>
          </div>

          <div className="action-stage-card">
            <div className="action-stage-label">Cover letter</div>
            <div className="action-stage-actions">
              <button
                type="button"
                className={`${hasCoverLetter ? "primary-button" : "secondary-button"}`}
                disabled={!coverLetterText?.text_content}
                onClick={() => onCopyText(coverLetterText?.text_content || "", "Cover letter copied")}
              >
                <Copy size={16} />
                Copy cover letter
              </button>
              {coverLetterPdf ? (
                <a className="secondary-button" href={`/api/documents/${job.id}/${coverLetterPdf.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  Open PDF
                </a>
              ) : (
                <span className="detail-muted-card">No PDF attached yet.</span>
              )}
            </div>
          </div>

          <div className="action-stage-card action-stage-after">
            <div className="action-stage-label">After submitting</div>
            <div className="action-stage-actions">
              <button type="button" className="secondary-button" onClick={() => onStatusChange(job.id, "skipped", job.appliedAt, notes)}>
                <Archive size={16} />
                Skip role
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="section-titleline">
          <BriefcaseBusiness size={16} />
          <h3>Assessment</h3>
        </div>
        <p>{latestReview?.fit_assessment || job.description_summary || "No fit summary yet."}</p>
        <p className="muted">{latestReview?.risk_note || "No risk note recorded."}</p>
        <p className="muted">{latestReview?.legitimacy_note || "No legitimacy note recorded."}</p>
      </section>

      <section className="detail-section">
        <div className="section-titleline">
          <CircleAlert size={16} />
          <h3>Application Status</h3>
        </div>
        <p className="muted status-help">
          <strong>Ready</strong> means the role is staged for submission but not applied yet. <strong>Skipped</strong> means you do not want to pursue it. <strong>Applied</strong> means you have actually submitted the application.
        </p>
        <div className="status-grid">
          {Object.entries(statusLabels).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`status-choice ${value === (job.applicationStatus || "not_started") ? "is-current" : ""}`}
              onClick={() =>
                onStatusChange(
                  job.id,
                  value,
                  value === "applied" ? job.appliedAt || new Date().toISOString().slice(0, 10) : job.appliedAt,
                  notes,
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          className="notes-box"
          placeholder="Application notes, recruiter names, follow-up reminders…"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => onStatusChange(job.id, job.applicationStatus || "not_started", job.appliedAt, notes)}
        />
      </section>

      <section className="detail-section">
        <div className="section-titleline">
          <FileText size={16} />
          <h3>Cover Letter</h3>
        </div>
        <p className="muted cover-letter-help">
          Recommend roles should usually arrive with a stored cover letter from the daily workflow. Use the fallback prompt only if this role is missing one or you want a rewrite.
        </p>
        <div className="cover-letter-fallback-row">
          <button type="button" className="secondary-button compact-button" onClick={() => onCopyPrompt(coverLetterPrompt)}>
            <Copy size={16} />
            Copy fallback prompt
          </button>
        </div>
        <details className="prompt-preview">
          <summary>Preview fallback prompt</summary>
          <pre className="cover-letter-preview prompt-preview-body">{coverLetterPrompt}</pre>
        </details>
        <div className="document-paths">
          <div className="document-path-card">
            <div className="document-path-label">Stored text file</div>
            <code className="document-path-value">{coverLetterText?.file_path || "No stored text file yet."}</code>
            <div className="document-path-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={!coverLetterText?.file_path}
                onClick={() => onCopyText(coverLetterText?.file_path || "", "Text file path copied")}
              >
                <Copy size={16} />
                Copy text path
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={!coverLetterText?.id}
                onClick={() => onRevealDocument(job.id, coverLetterText?.id, "Text file")}
              >
                <ExternalLink size={16} />
                Reveal in Finder
              </button>
            </div>
          </div>
          <div className="document-path-card">
            <div className="document-path-label">Stored PDF file</div>
            <code className="document-path-value">{coverLetterPdf?.file_path || "No stored PDF file yet."}</code>
            <div className="document-path-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={!coverLetterPdf?.file_path}
                onClick={() => onCopyText(coverLetterPdf?.file_path || "", "PDF file path copied")}
              >
                <Copy size={16} />
                Copy PDF path
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={!coverLetterPdf?.id}
                onClick={() => onRevealDocument(job.id, coverLetterPdf?.id, "PDF file")}
              >
                <ExternalLink size={16} />
                Reveal in Finder
              </button>
            </div>
          </div>
        </div>
        <pre className="cover-letter-preview">
          {coverLetterText?.text_content || "No copyable cover letter stored for this job yet. Use the fallback button above if this application needs one."}
        </pre>
      </section>
    </aside>
  );
}

export default function HomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const dashboardData = dashboard || emptyDashboard;
  const isInitialLoading = dashboard === null && !loadError;

  const applyDashboard = useCallback((data, preferredSelectedJobId = selectedJobId) => {
    setLoadError("");
    setDashboard(data);
    const nextSelectedJobId = resolveSelectedJobId(data, preferredSelectedJobId);
    setSelectedJobId(nextSelectedJobId);
    return nextSelectedJobId;
  }, [selectedJobId]);

  async function loadDashboard(preferredSelectedJobId = selectedJobId) {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await readJsonResponse(response, "Dashboard request failed.");

    if (!response.ok) {
      throw new Error(data?.error || "Dashboard request failed.");
    }

    return applyDashboard(data, preferredSelectedJobId);
  }

  async function loadSelectedJob(jobId = selectedJobId) {
    if (!jobId) return;
    const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    const data = await readJsonResponse(response, "Job detail request failed.");

    if (!response.ok) {
      if (response.status === 404) {
        setSelectedJob(null);
        return null;
      }
      throw new Error(data?.error || "Job detail request failed.");
    }

    setSelectedJob(data);
    return data;
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => readJsonResponse(response, "Dashboard request failed."))
      .then((data) => {
        if (cancelled) return;
        setDashboard(data);
        setSelectedJobId(resolveSelectedJobId(data, null));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || "Dashboard request failed.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    fetch(`/api/jobs/${selectedJobId}`, { cache: "no-store" })
      .then((response) => readJsonResponse(response, "Job detail request failed."))
      .then((data) => setSelectedJob(data))
      .catch((error) => {
        setToast(error.message || "Job detail request failed.");
      });
  }, [selectedJobId]);

  const allJobs = useMemo(
    () =>
      sortJobsForAction([
        ...(dashboardData.grouped.recommend || []),
        ...(dashboardData.grouped.borderline || []),
        ...(dashboardData.grouped.skip || []),
      ]),
    [dashboardData],
  );

  const queueJobs = useMemo(
    () => allJobs.filter((job) => !queueHiddenStatuses.has(job.applicationStatus || "not_started")),
    [allJobs],
  );

  const filteredJobs = useMemo(() => {
    const filtered = allJobs.filter((job) =>
      matchesJobFilters(job, {
        searchText,
        bucketFilter,
        sourceFilter,
        modeFilter,
      }),
    );

    return sortVisibleJobs(filtered, sortMode);
  }, [allJobs, bucketFilter, modeFilter, searchText, sortMode, sourceFilter]);

  const filteredQueueJobs = useMemo(
    () => filteredJobs.filter((job) => !queueHiddenStatuses.has(job.applicationStatus || "not_started")),
    [filteredJobs],
  );

  const applyNextJobs = useMemo(
    () =>
      filteredQueueJobs.filter((job) => {
        const status = job.applicationStatus || "not_started";
        return status === "ready_to_apply" || job.bucket === "recommend";
      }),
    [filteredQueueJobs],
  );

  const reviewLaterJobs = useMemo(
    () => filteredQueueJobs.filter((job) => !applyNextJobs.some((candidate) => candidate.id === job.id)),
    [filteredQueueJobs, applyNextJobs],
  );

  const pipelineJobs = useMemo(
    () => allJobs.filter((job) => ["applied", "interview"].includes(job.applicationStatus || "not_started")),
    [allJobs],
  );

  const archivedJobs = useMemo(
    () => allJobs.filter((job) => ["skipped", "rejected", "closed"].includes(job.applicationStatus || "not_started")),
    [allJobs],
  );

  const filteredPipelineJobs = useMemo(
    () => filteredJobs.filter((job) => ["applied", "interview"].includes(job.applicationStatus || "not_started")),
    [filteredJobs],
  );

  const filteredArchivedJobs = useMemo(
    () => filteredJobs.filter((job) => ["skipped", "rejected", "closed"].includes(job.applicationStatus || "not_started")),
    [filteredJobs],
  );

  const focusHeadline = applyNextJobs[0] || reviewLaterJobs[0] || null;
  const firstPipelineJob = pipelineJobs[0] || archivedJobs[0] || null;

  async function handleStatusChange(jobId, status, appliedAt, notes) {
    const response = await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, appliedAt, notes }),
    });
    const data = await readJsonResponse(response, "Status update failed.");
    if (!response.ok) {
      throw new Error(data?.error || "Status update failed.");
    }
    setSelectedJob(data);
    setSelectedJobId(jobId);
    await loadDashboard(jobId);
    await loadSelectedJob(jobId);
  }

  async function handleCopy(text, successMessage = "Copied") {
    await navigator.clipboard.writeText(text);
    setToast(successMessage);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function handleRevealDocument(jobId, documentId, label) {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/documents/${jobId}/${documentId}/reveal`, {
        method: "POST",
      });
      const data = await readJsonResponse(response, "Reveal document failed.");

      if (!response.ok) {
        throw new Error(data?.error || "Reveal document failed.");
      }

      setToast(`${label} revealed in Finder`);
      window.setTimeout(() => setToast(""), 1800);
    } catch (error) {
      setToast(error.message || "Reveal document failed.");
      window.setTimeout(() => setToast(""), 2200);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncTracker() {
      if (document.visibilityState === "hidden") return;

      try {
        const dashboardResponse = await fetch("/api/dashboard", { cache: "no-store" });
        const nextDashboard = await readJsonResponse(dashboardResponse, "Dashboard request failed.");
        if (!dashboardResponse.ok || cancelled) return;

        const nextSelectedJobId = applyDashboard(nextDashboard, selectedJobId);
        if (!nextSelectedJobId) {
          setSelectedJob(null);
          return;
        }

        const jobResponse = await fetch(`/api/jobs/${nextSelectedJobId}`, { cache: "no-store" });
        const jobData = await readJsonResponse(jobResponse, "Job detail request failed.");
        if (!jobResponse.ok || cancelled) return;
        setSelectedJob(jobData);
      } catch {
        // Silent background sync.
      }
    }

    const intervalId = window.setInterval(syncTracker, 8000);
    window.addEventListener("focus", syncTracker);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncTracker);
    };
  }, [selectedJobId, applyDashboard]);

  return (
    <main className="tracker-shell">
      <TrackerNav />

      <header className="hero compact-hero">
        <div>
          <div className="eyebrow">Application workspace</div>
          <h1>Apply Next</h1>
          <p>Start with the strongest active roles, then move submitted and closed roles out of the way.</p>
        </div>
      </header>

      {loadError ? (
        <StatePanel
          icon={CircleAlert}
          kicker="Tracker unavailable"
          title="Could not load the application queue."
          description="The data source did not respond. Retry once the local server and SQLite database are ready."
          actionLabel="Retry"
          onAction={() => {
            setLoadError("");
            loadDashboard().catch((error) => setLoadError(error.message || "Dashboard request failed."));
          }}
        />
      ) : null}

      {isInitialLoading ? (
        <StatePanel
          icon={RefreshCw}
          kicker="Loading"
          title="Preparing the current queue."
          description="Pulling tracked roles, application status, documents, and the latest shortlist signals."
        />
      ) : null}

      {!isInitialLoading && !loadError && allJobs.length === 0 ? (
        <StatePanel
          icon={Database}
          kicker="No tracked roles"
          title="Import a shortlist to start."
          description="Once roles are imported, they will be sorted into apply-next, review-later, in-flight, and archive lanes."
        />
      ) : null}

      {!isInitialLoading && !loadError && allJobs.length > 0 ? (
        <>
      <section className="stats-strip">
        <StatCard label="Apply Next" value={applyNextJobs.length} tone="recommend" hint="recommend + ready" />
        <StatCard label="Review Later" value={reviewLaterJobs.length} tone="borderline" hint="borderline + lower confidence" />
        <StatCard label="In Flight" value={pipelineJobs.length} tone="applied" hint="applied + interview" />
        <StatCard label="Archive" value={archivedJobs.length} tone="skip" hint="skipped + rejected + closed" />
      </section>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <section className="focus-strip focus-strip-compact">
        <div className="focus-copy">
          <div className="section-titleline">
            <Sparkles size={16} />
            <h2>Queue Snapshot</h2>
          </div>
          <p>
            {queueJobs.length
              ? "Active roles that still need a decision or submission."
              : "No active roles are waiting right now. Check In Flight or Archive if you need to review past decisions."}
          </p>
        </div>
        <div className="focus-summary focus-summary-wide">
          <div className="focus-chip">
            <ListTodo size={14} />
            <span>{queueJobs.length} active roles</span>
          </div>
          <div className="focus-chip">
            <Hourglass size={14} />
            <span>{applyNextJobs.length} ready or strong-fit</span>
          </div>
          {focusHeadline ? (
            <button type="button" className="focus-hero-card" onClick={() => setSelectedJobId(focusHeadline.id)}>
              <div className="focus-hero-label">Selected next</div>
              <div className="focus-hero-title">{focusHeadline.title}</div>
              <div className="focus-hero-meta">
                <span>{focusHeadline.company}</span>
                <span>{focusHeadline.bucket === "recommend" ? "Apply next" : "Review later"}</span>
              </div>
            </button>
          ) : (
            <div className="focus-hero-card is-empty">No active roles need action right now.</div>
          )}
        </div>
      </section>

      <section className="main-grid redesigned-grid">
        <div className="queue-column">
          <QueueFilters
            searchText={searchText}
            onSearchChange={setSearchText}
            bucketFilter={bucketFilter}
            onBucketChange={setBucketFilter}
            sourceFilter={sourceFilter}
            onSourceChange={setSourceFilter}
            modeFilter={modeFilter}
            onModeChange={setModeFilter}
            sortMode={sortMode}
            onSortChange={setSortMode}
            filteredCount={filteredJobs.length}
            totalCount={allJobs.length}
            activeFilteredCount={filteredQueueJobs.length}
            activeTotalCount={queueJobs.length}
            pipelineFilteredCount={filteredPipelineJobs.length}
            archiveFilteredCount={filteredArchivedJobs.length}
            onReset={() => {
              setSearchText("");
              setBucketFilter("all");
              setSourceFilter("all");
              setModeFilter("all");
              setSortMode("priority");
            }}
          />
          {queueJobs.length ? (
            <>
              <QueueSection
                icon={Sparkles}
                title="Apply Next"
                subtitle={`${applyNextJobs.length} strongest roles to work through first`}
                jobs={applyNextJobs}
                activeJobId={selectedJobId}
                onSelect={setSelectedJobId}
                mode="Apply next"
              />
              <QueueSection
                icon={Hourglass}
                title="Review Later"
                subtitle={`${reviewLaterJobs.length} roles to revisit after the primary queue`}
                jobs={reviewLaterJobs}
                activeJobId={selectedJobId}
                onSelect={setSelectedJobId}
                mode="Review later"
              />
            </>
          ) : (
            <QueueEmptyState
              onSelectPipeline={() => firstPipelineJob && setSelectedJobId(firstPipelineJob.id)}
              hasPipeline={Boolean(firstPipelineJob)}
            />
          )}
        </div>

        <DetailPanel
          job={selectedJob}
          onStatusChange={handleStatusChange}
          onCopyText={handleCopy}
          onCopyPrompt={(text) => handleCopy(text, "Cover-letter prompt copied")}
          onRevealDocument={handleRevealDocument}
        />
      </section>

      <section className="pipeline-shell">
        <div className="pipeline-header">
          <div className="section-titleline">
            <MessageSquareMore size={16} />
            <h2>Applied Pipeline</h2>
          </div>
          <p>Roles move here once they are submitted so the active queue stays calm.</p>
        </div>
        <div className="pipeline-grid">
          {filteredPipelineJobs.length ? (
            filteredPipelineJobs.map((job) => (
              <PipelineCard key={job.id} job={job} active={selectedJobId === job.id} onSelect={setSelectedJobId} />
            ))
          ) : (
            <div className="empty-card">
              {pipelineJobs.length ? "No pipeline roles match the current search." : "No applied or interview-stage roles yet."}
            </div>
          )}
        </div>
      </section>

      <section className="archive-shell">
        <div className="section-titleline">
          <Archive size={16} />
          <h2>Archive</h2>
        </div>
        <p className="archive-copy">Rejected and closed roles stay recorded here without competing for attention.</p>
        <div className="archive-grid">
          {filteredArchivedJobs.length ? (
            filteredArchivedJobs.map((job) => (
              <PipelineCard
                key={`${job.id}-archive`}
                job={job}
                active={selectedJobId === job.id}
                onSelect={setSelectedJobId}
              />
            ))
          ) : (
            <div className="empty-card">
              {archivedJobs.length ? "No archived roles match the current search." : "No archived roles yet."}
            </div>
          )}
        </div>
      </section>
        </>
      ) : null}
    </main>
  );
}
