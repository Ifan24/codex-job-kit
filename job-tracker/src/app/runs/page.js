import TrackerNav from "@/components/TrackerNav";
import { getWorkflowRunsData } from "@/lib/db";
import { bucketLabels, statusLabels } from "@/lib/statuses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateTime(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPlatforms(platforms) {
  if (!platforms) return "Not recorded";
  return platforms;
}

function qualityLabel(quality) {
  if (quality === "good") return "Good";
  if (quality === "mixed") return "Mixed";
  if (quality === "degraded") return "Degraded";
  return "Unrated";
}

function formatBlockedSource(item) {
  return typeof item === "string" ? item : `${item.source}${item.reason ? `: ${item.reason}` : ""}`;
}

function formatDelta(value) {
  if (value > 0) return `Up ${value}`;
  if (value < 0) return `Down ${Math.abs(value)}`;
  return "Flat";
}

function summarizeTrend(values) {
  const normalized = values.map((value) => Number(value || 0));
  const latest = normalized.at(-1) ?? 0;
  const previous = normalized.at(-2) ?? latest;
  const peak = normalized.length ? Math.max(...normalized) : 0;
  const average = normalized.length
    ? Math.round((normalized.reduce((sum, value) => sum + value, 0) / normalized.length) * 10) / 10
    : 0;

  return {
    latest,
    previous,
    delta: latest - previous,
    peak,
    average,
  };
}

function buildSparkline(values, width = 420, height = 110) {
  const normalized = values.map((value) => Number(value || 0));
  const max = Math.max(1, ...normalized);
  const stepX = normalized.length > 1 ? width / (normalized.length - 1) : width;
  const points = normalized.map((value, index) => {
    const x = index * stepX;
    const y = height - (value / max) * (height - 12) - 6;
    return { x, y, value };
  });

  const linePath = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = [`0,${height}`, ...points.map((point) => `${point.x},${point.y}`), `${width},${height}`].join(" ");

  return {
    points,
    linePath,
    areaPath,
  };
}

function TrendCard({ title, description, values, labels, tone = "recommend", emptyHint = "" }) {
  const hasData = values.length > 0;
  const summary = summarizeTrend(values);
  const sparkline = hasData ? buildSparkline(values) : null;
  const latestIndex = Math.max(0, values.length - 1);
  const latestPoint = sparkline?.points?.[latestIndex] || { x: 0, y: 0 };
  const midIndex = Math.floor((labels.length - 1) / 2);
  const axisLabels = hasData
    ? [0, midIndex, labels.length - 1]
        .filter((index, position, array) => array.indexOf(index) === position)
        .map((index) => ({ index, label: labels[index] }))
    : [];

  return (
    <article className="runs-panel trend-panel">
      <div className="section-titleline">
        <h2>{title}</h2>
      </div>
      <p className="muted">{description}</p>

      <div className="trend-summary-row">
        <div className="trend-stat">
          <span className="field-label">Latest</span>
          <strong>{summary.latest}</strong>
        </div>
        <div className="trend-stat">
          <span className="field-label">Average</span>
          <strong>{summary.average}</strong>
        </div>
        <div className="trend-stat">
          <span className="field-label">Peak</span>
          <strong>{summary.peak}</strong>
        </div>
        <div className={`trend-delta trend-${summary.delta > 0 ? "up" : summary.delta < 0 ? "down" : "flat"} trend-${tone}`}>
          {formatDelta(summary.delta)}
        </div>
      </div>

      {hasData ? (
        <div className="sparkline-shell" role="img" aria-label={`${title} trend chart`}>
          <svg viewBox="0 0 420 110" className="sparkline-chart" preserveAspectRatio="none">
            <polyline className={`sparkline-area sparkline-area-${tone}`} points={sparkline.areaPath} />
            <polyline className={`sparkline-line sparkline-line-${tone}`} points={sparkline.linePath} />
            <circle className={`sparkline-dot sparkline-dot-${tone}`} cx={latestPoint.x} cy={latestPoint.y} r="4.5" />
          </svg>
          <div className="sparkline-axis">
            {axisLabels.map((item) => (
              <span key={`${title}-${item.index}`}>{item.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="trend-empty">
          <p className="muted">No run data recorded yet.</p>
        </div>
      )}

      {summary.peak === 0 && emptyHint ? <p className="muted trend-note">{emptyHint}</p> : null}
    </article>
  );
}

function formatProcessLabel(value, labels) {
  return labels[value] || value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function widthPercent(value, max) {
  if (!max) return "0%";
  return `${Math.max(4, Math.round((Number(value || 0) / max) * 100))}%`;
}

function statusTone(status) {
  if (status === "applied" || status === "interview") return "applied";
  if (status === "ready_to_apply") return "borderline";
  if (status === "rejected" || status === "closed" || status === "skipped") return "skip";
  return "neutral";
}

function ProcessSummary({ summary }) {
  const funnelMax = Math.max(1, ...summary.funnel.map((item) => item.total));
  const sourceMax = Math.max(1, ...summary.sourceOutcomes.map((item) => item.total));
  const flowMax = Math.max(1, ...summary.bucketStatusFlows.map((item) => item.count));
  const hasFunnelData = summary.funnel.some((item) => item.total > 0 || item.latest > 0);
  const hasApplicationData = summary.totalJobs > 0;

  return (
    <section className="process-summary-panel">
      <div className="process-summary-header">
        <div>
          <div className="eyebrow">Process Summary</div>
          <h2>Application Flow</h2>
          <p className="muted">
            Shortlist volume, source mix, and recommendation outcomes from current tracker data and finalized runs.
          </p>
        </div>
        <div className="process-summary-total">
          <span className="field-label">Tracked jobs</span>
          <strong>{summary.totalJobs}</strong>
        </div>
      </div>

      <div className="process-summary-grid">
        <article className="process-card process-funnel-card">
          <div className="section-titleline">
            <h3>Workflow Funnel</h3>
          </div>
          {hasFunnelData ? (
            <div className="process-funnel-list">
              {summary.funnel.map((stage) => (
                <div key={stage.key} className="process-funnel-row">
                  <div className="process-row-top">
                    <span>{stage.label}</span>
                    <strong>{stage.total}</strong>
                  </div>
                  <div className="process-bar-track">
                    <div className="process-bar-fill process-bar-recommend" style={{ width: widthPercent(stage.total, funnelMax) }} />
                  </div>
                  <div className="process-row-caption">Latest run: {stage.latest}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="process-empty">Finalized runs have not recorded funnel counts yet.</div>
          )}
        </article>

        <article className="process-card">
          <div className="section-titleline">
            <h3>Source To Outcome</h3>
          </div>
          {hasApplicationData ? (
            <div className="process-source-list">
              {summary.sourceOutcomes.slice(0, 7).map((source) => (
                <div key={source.platform} className="process-source-row">
                  <div className="process-row-top">
                    <span>{source.platform}</span>
                    <strong>{source.total}</strong>
                  </div>
                  <div className="process-segment-track" style={{ width: widthPercent(source.total, sourceMax) }}>
                    {summary.statusOrder.map((status) => {
                      const value = source.statuses[status] || 0;
                      if (!value) return null;
                      return (
                        <span
                          key={`${source.platform}-${status}`}
                          className={`process-segment process-segment-${statusTone(status)}`}
                          style={{ flexGrow: value }}
                          title={`${formatProcessLabel(status, statusLabels)}: ${value}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="process-empty">No tracked jobs yet.</div>
          )}
        </article>

        <article className="process-card process-flow-card">
          <div className="section-titleline">
            <h3>Recommendation To Status</h3>
          </div>
          {hasApplicationData ? (
            <div className="process-flow-list">
              {summary.bucketStatusFlows.map((flow) => (
                <div key={`${flow.bucket}-${flow.status}`} className="process-flow-row">
                  <div className="process-flow-label">
                    <span className={`bucket-pill bucket-${flow.bucket}`}>{formatProcessLabel(flow.bucket, bucketLabels)}</span>
                    <span className={`status-pill status-${flow.status}`}>{formatProcessLabel(flow.status, statusLabels)}</span>
                  </div>
                  <div className="process-bar-track">
                    <div
                      className={`process-bar-fill process-bar-${statusTone(flow.status)}`}
                      style={{ width: widthPercent(flow.count, flowMax) }}
                    />
                  </div>
                  <strong>{flow.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="process-empty">Recommendation flow will appear after jobs are imported.</div>
          )}
        </article>
      </div>
    </section>
  );
}

export default function WorkflowRunsPage() {
  const data = getWorkflowRunsData({ limit: 24 });
  const latestRun = data.runs[0] || null;
  const trendLabels = data.trends.map((run) => run.label);
  const recommendValues = data.trends.map((run) => run.importedRecommend || 0);
  const harvestValues = data.trends.map((run) => run.rawHarvested || 0);

  return (
    <main className="tracker-shell">
      <TrackerNav />

      <header className="hero compact-hero page-header-card">
        <div>
          <div className="eyebrow">Workflow history</div>
          <h1>Workflow Runs</h1>
          <p>
            Check the latest shortlist outcome first, then compare blockers, import drift, and source quality across runs.
          </p>
        </div>
      </header>

      <section className="runs-hero-grid runs-hero-single">
        <article className="runs-panel latest-run-panel latest-run-surface">
          <div className="latest-run-heading">
            <div>
              <div className="field-label">Latest Run</div>
              <h2>{latestRun ? formatDateTime(latestRun.searchedAt || latestRun.createdAt) : "No workflow runs recorded yet"}</h2>
              {latestRun ? <p className="muted latest-run-platforms">{formatPlatforms(latestRun.platforms)}</p> : null}
            </div>
            {latestRun ? (
              <div className="latest-run-topline">
                <span className={`quality-badge quality-${latestRun.runQuality || "unknown"}`}>
                  {qualityLabel(latestRun.runQuality)}
                </span>
                <span className="meta-chip">Prompt {latestRun.promptVersion || "legacy"}</span>
                {latestRun.promptUpdated ? <span className="meta-chip">Prompt updated</span> : null}
                {latestRun.blockedSources.length ? (
                  <span className="meta-chip">{latestRun.blockedSources.length} blocked source{latestRun.blockedSources.length === 1 ? "" : "s"}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {latestRun ? (
            <>
              <p className="latest-run-summary">
                {latestRun.summary || "No run summary was saved. Import counts and blockers are still available below."}
              </p>

              <div className="latest-run-grid">
                <div className="latest-run-side">
                  <div className="detail-muted-card latest-run-signal-card">
                    <div className="field-label">Main signal</div>
                    {latestRun.nextRunAdjustments.length ? (
                      <p>{latestRun.nextRunAdjustments[0]}</p>
                    ) : latestRun.workflowIssues.length ? (
                      <p>{latestRun.workflowIssues[0]}</p>
                    ) : (
                      <p>No retrospective note recorded yet for this run.</p>
                    )}
                  </div>

                  <div className="detail-muted-card">
                    <div className="field-label">What To Watch</div>
                    <ul className="run-list-items compact-run-list">
                      <li>Recommend counts staying healthy over time.</li>
                      <li>Repeated blocked sources across multiple runs.</li>
                      <li>Whether next-run adjustments are actually being recorded.</li>
                    </ul>
                  </div>
                </div>

                <div className="detail-muted-card latest-run-import-card">
                  <div className="field-label">Import Snapshot</div>
                  <div className="mini-stat-grid">
                    <div className="mini-stat-card mini-stat-primary">
                      <span className="mini-stat-label">Recommend</span>
                      <strong>{latestRun.funnel.importedRecommend ?? latestRun.importSummary.importedRecommend ?? 0}</strong>
                    </div>
                    <div className="mini-stat-card mini-stat-primary">
                      <span className="mini-stat-label">Borderline</span>
                      <strong>{latestRun.funnel.importedBorderline ?? latestRun.importSummary.importedBorderline ?? 0}</strong>
                    </div>
                    <div className="mini-stat-card mini-stat-primary">
                      <span className="mini-stat-label">Skip</span>
                      <strong>{latestRun.funnel.importedSkip ?? latestRun.importSummary.importedSkip ?? 0}</strong>
                    </div>
                    <div className="mini-stat-card">
                      <span className="mini-stat-label">Created</span>
                      <strong>{latestRun.importSummary.created ?? 0}</strong>
                    </div>
                    <div className="mini-stat-card">
                      <span className="mini-stat-label">Updated</span>
                      <strong>{latestRun.importSummary.updated ?? 0}</strong>
                    </div>
                    <div className="mini-stat-card">
                      <span className="mini-stat-label">Excluded</span>
                      <strong>{latestRun.importSummary.excludedExisting ?? 0}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {latestRun.blockedSources.length ? (
                <div className="run-section">
                  <div className="field-label">Top blockers</div>
                  <ul className="run-list-items compact-run-list">
                    {latestRun.blockedSources.slice(0, 2).map((item, index) => (
                      <li key={`latest-run-blocked-${index}`}>{formatBlockedSource(item)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">No workflow runs recorded yet.</p>
          )}
        </article>
      </section>

      <section className="stats-strip runs-stat-grid run-health-strip">
        <div className="stat-pill stat-recommend">
          <div>
            <div className="stat-pill-label">Runs tracked</div>
            <div className="stat-pill-hint">Latest 24 runs</div>
          </div>
          <div className="stat-pill-value">{data.counts.total}</div>
        </div>
        <div className="stat-pill stat-recommend">
          <div>
            <div className="stat-pill-label">Good</div>
            <div className="stat-pill-hint">Clean runs</div>
          </div>
          <div className="stat-pill-value">{data.counts.good}</div>
        </div>
        <div className="stat-pill stat-borderline">
          <div>
            <div className="stat-pill-label">Mixed</div>
            <div className="stat-pill-hint">Usable with blockers</div>
          </div>
          <div className="stat-pill-value">{data.counts.mixed}</div>
        </div>
        <div className="stat-pill stat-skip">
          <div>
            <div className="stat-pill-label">Degraded</div>
            <div className="stat-pill-hint">Needs follow-up</div>
          </div>
          <div className="stat-pill-value">{data.counts.degraded}</div>
        </div>
        <div className="stat-pill stat-applied">
          <div>
            <div className="stat-pill-label">Prompt updated</div>
            <div className="stat-pill-hint">Self-improved runs</div>
          </div>
          <div className="stat-pill-value">{data.counts.promptUpdated}</div>
        </div>
      </section>

      <section className="runs-overview-note">
        <div className="field-label">Data Coverage</div>
        <p className="muted">
          Older runs may have fewer retrospective fields. Run quality, lane reviews, and prompt-update signals become richer after finalize records are present.
        </p>
      </section>

      <section className="runs-overview-grid compact-run-grid">
        <TrendCard
          title="Recommend Trend"
          description="How many recommend roles each run imported after filtering and dedupe."
          values={recommendValues}
          labels={trendLabels}
          tone="recommend"
        />
        <TrendCard
          title="Harvest Trend"
          description="Raw harvested count before main-agent cleanup, when the run recorded it."
          values={harvestValues}
          labels={trendLabels}
          tone="harvest"
          emptyHint="Older runs did not record harvested counts yet, so this chart will get more useful as finalized runs accumulate."
        />
      </section>

      <ProcessSummary summary={data.processSummary} />

      <section className="runs-list">
        {data.runs.map((run) => {
          const importSummary = run.importSummary || {};
          const funnel = run.funnel || {};

          return (
            <details key={run.id} className="run-card">
              <summary className="run-card-summary">
                <div>
                  <div className="eyebrow">Run {run.id}</div>
                  <h2>{formatDateTime(run.searchedAt || run.createdAt)}</h2>
                  <p className="muted">{formatPlatforms(run.platforms)}</p>
                </div>
                <div className="run-card-meta">
                  <span className={`quality-badge quality-${run.runQuality || "unknown"}`}>
                    {qualityLabel(run.runQuality)}
                  </span>
                  <span className="meta-chip">Prompt {run.promptVersion || "legacy"}</span>
                  <span className="meta-chip">{importSummary.created ?? 0} created</span>
                  <span className="meta-chip">{importSummary.updated ?? 0} updated</span>
                  <span className="meta-chip">{importSummary.excludedExisting ?? 0} excluded</span>
                </div>
              </summary>

              <div className="run-card-body">
                {run.summary ? <p>{run.summary}</p> : null}

                <div className="run-metric-grid">
                  <div className="detail-muted-card">
                    <div className="field-label">Funnel</div>
                    <p>
                      Raw {funnel.rawHarvested ?? "—"} · Unique {funnel.uniqueAfterCheapDedupe ?? "—"} · Verified{" "}
                      {funnel.livePagesVerified ?? "—"}
                    </p>
                    <p>
                      Imported {funnel.importedRecommend ?? importSummary.importedRecommend ?? 0} recommend,{" "}
                      {funnel.importedBorderline ?? importSummary.importedBorderline ?? 0} borderline,{" "}
                      {funnel.importedSkip ?? importSummary.importedSkip ?? 0} skip
                    </p>
                  </div>
                  <div className="detail-muted-card">
                    <div className="field-label">Cover letters</div>
                    <p>
                      Generated {run.coverLetterSummary.generated ?? 0} · Failed {run.coverLetterSummary.failed ?? 0}
                    </p>
                    {run.promptUpdated ? <p>Prompt updated during or after this run.</p> : <p>No prompt update recorded.</p>}
                  </div>
                </div>

                {run.blockedSources.length ? (
                  <div className="run-section">
                    <div className="field-label">Blocked sources</div>
                    <div className="chip-row">
                      {run.blockedSources.map((item, index) => {
                        return (
                          <span key={`${run.id}-blocked-${index}`} className="meta-chip">
                            {formatBlockedSource(item)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {run.workflowIssues.length ? (
                  <div className="run-section">
                    <div className="field-label">Workflow issues</div>
                    <ul className="run-list-items">
                      {run.workflowIssues.map((issue, index) => (
                        <li key={`${run.id}-issue-${index}`}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {run.nextRunAdjustments.length ? (
                  <div className="run-section">
                    <div className="field-label">Next-run adjustments</div>
                    <ul className="run-list-items">
                      {run.nextRunAdjustments.map((item, index) => (
                        <li key={`${run.id}-adjustment-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {run.laneReviews.length ? (
                  <div className="run-section">
                    <div className="field-label">Lane reviews</div>
                    <div className="lane-review-list">
                      {run.laneReviews.map((lane, index) => (
                        <article key={`${run.id}-lane-${index}`} className="lane-review-card">
                          <div className="lane-review-top">
                            <strong>{lane.lane}</strong>
                            <span className="meta-chip">
                              {lane.finishedCleanly === false ? "Partial" : lane.finishedCleanly === true ? "Clean" : "Unknown"}
                            </span>
                            {lane.authStatus ? <span className="meta-chip">Auth {lane.authStatus}</span> : null}
                          </div>
                          <p className="muted">
                            Stable URLs {lane.stableUrlsCaptured ?? "—"} · Candidates {lane.candidatesReturned ?? "—"}
                          </p>
                          {lane.notes ? <p>{lane.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {run.snapshotPath ? (
                  <div className="run-section">
                    <div className="field-label">Snapshot</div>
                    <code>{run.snapshotPath}</code>
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}
