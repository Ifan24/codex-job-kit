"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarRange, CircleAlert, RefreshCw } from "lucide-react";
import TrackerNav from "@/components/TrackerNav";
import { ActivityTimelineBoard } from "@/components/ActivityTimeline";
import { statusLabels } from "@/lib/statuses";

const VIEW_OPTIONS = [7, 14, 30];
const HIGH_SIGNAL_KINDS = new Set([
  "applied",
  "prep_done",
  "interview",
  "rejected",
  "skipped",
  "closed",
  "action_required",
  "cover_letter",
]);

const emptyTimeline = {
  generatedAt: null,
  counts: {
    total: 0,
    actionRequired: 0,
    applied: 0,
    interviews: 0,
  },
  view: {
    days: 7,
    offset: 0,
    startDate: null,
    endDate: null,
    hasOlder: false,
    hasNewer: false,
  },
  dayEntries: [],
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

function formatRangeLabel(view) {
  if (!view?.startDate || !view?.endDate) return "Past 7 days";

  const formatter = new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
  });
  const start = formatter.format(new Date(`${view.startDate}T12:00:00`));
  const end = formatter.format(new Date(`${view.endDate}T12:00:00`));
  return `${start} to ${end}`;
}

function TimelineState({ icon: Icon, kicker, title, description, actionLabel, onAction }) {
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

export default function TimelinePage() {
  const [days, setDays] = useState(7);
  const [offset, setOffset] = useState(0);
  const [eventScope, setEventScope] = useState("high_signal");
  const [timeline, setTimeline] = useState(emptyTimeline);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadTimeline = useCallback(async (currentDays, currentOffset) => {
    const response = await fetch(`/api/timeline?days=${currentDays}&offset=${currentOffset}`, { cache: "no-store" });
    const data = await readJsonResponse(response, "Timeline request failed.");

    if (!response.ok) {
      throw new Error(data?.error || "Timeline request failed.");
    }

    setTimeline(data);
    setLoadError("");
    setToast("");
  }, []);

  async function handleStatusChange(event, status) {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/jobs/${event.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          appliedAt: status === "applied" ? new Date().toISOString().slice(0, 10) : undefined,
        }),
      });
      const data = await readJsonResponse(response, "Status update failed.");

      if (!response.ok) {
        throw new Error(data?.error || "Status update failed.");
      }

      await loadTimeline(days, offset);
      setToast(`${event.jobTitle} marked ${statusLabels[status].toLowerCase()}.`);
    } catch (error) {
      setToast(error.message || "Status update failed.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    loadTimeline(days, offset)
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || "Timeline request failed.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days, offset, loadTimeline]);

  const filteredDayEntries = useMemo(() => {
    if (eventScope === "action") {
      return timeline.dayEntries.map((day) => ({
        ...day,
        events: day.events.filter((event) => event.kind === "action_required"),
      }));
    }

    if (eventScope === "all") {
      return timeline.dayEntries;
    }

    return timeline.dayEntries.map((day) => ({
      ...day,
      events: day.events.filter((event) => HIGH_SIGNAL_KINDS.has(event.kind)),
    }));
  }, [eventScope, timeline.dayEntries]);

  const filteredCounts = useMemo(() => {
    const events = filteredDayEntries.flatMap((day) => day.events);
    return {
      total: events.length,
      actionRequired: events.filter((event) => event.kind === "action_required").length,
      applied: events.filter((event) => event.kind === "applied").length,
      interviews: events.filter((event) => event.kind === "interview").length,
    };
  }, [filteredDayEntries]);

  const timelineEventCount = useMemo(
    () => timeline.dayEntries.reduce((total, day) => total + (day.events?.length || 0), 0),
    [timeline.dayEntries],
  );

  const subtitle = useMemo(() => {
    if (filteredCounts.total) {
      if (eventScope === "action") {
        return "Follow-ups, recruiter asks, and assessment tasks that still need attention.";
      }
      return "Applications, interviews, rejections, saved documents, and follow-up requests in time order.";
    }
    return "No matching events for these dates. Try another range or show all events.";
  }, [eventScope, filteredCounts.total]);

  return (
    <main className="tracker-shell">
      <TrackerNav />

      <header className="hero compact-hero page-header-card timeline-page-hero">
        <div>
          <div className="eyebrow">Application history</div>
          <h1>Timeline</h1>
          <p>{subtitle}</p>
        </div>
        <div className="timeline-toolbar">
          <div className="timeline-view-switcher" aria-label="Timeline range">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`filter-chip ${days === option ? "is-active" : ""}`}
                aria-pressed={days === option}
                onClick={() => {
                  setIsLoading(true);
                  setDays(option);
                  setOffset(0);
                }}
              >
                {option} days
              </button>
            ))}
          </div>
          <div className="timeline-view-switcher" aria-label="Timeline signal filter">
            <button
              type="button"
              className={`filter-chip ${eventScope === "high_signal" ? "is-active" : ""}`}
              aria-pressed={eventScope === "high_signal"}
              onClick={() => {
                setEventScope("high_signal");
              }}
            >
              High signal
            </button>
            <button
              type="button"
              className={`filter-chip ${eventScope === "action" ? "is-active" : ""}`}
              aria-pressed={eventScope === "action"}
              onClick={() => {
                setEventScope("action");
              }}
            >
              Needs action
            </button>
            <button
              type="button"
              className={`filter-chip ${eventScope === "all" ? "is-active" : ""}`}
              aria-pressed={eventScope === "all"}
              onClick={() => {
                setEventScope("all");
              }}
            >
              All events
            </button>
          </div>
          <div className="timeline-window-nav">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => {
                setIsLoading(true);
                setOffset((current) => current + 1);
              }}
            >
              <ArrowLeft size={16} />
              Older
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => {
                setIsLoading(true);
                setOffset((current) => Math.max(0, current - 1));
              }}
              disabled={!timeline.view.hasNewer}
            >
              Newer
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      <section className="timeline-overview">
        <div className="timeline-overview-range">
          <div className="section-titleline">
            <CalendarRange size={16} />
            <h2>{formatRangeLabel(timeline.view)}</h2>
          </div>
          <p className="muted">
            {eventScope === "action"
              ? "Only unresolved follow-ups are shown. Move backward or widen the range for more context."
              : "Past 7 days are selected. Move backward or widen the range for more context."}
          </p>
        </div>
        <div className="timeline-overview-pills">
          <div className="focus-chip">
            <span>{filteredDayEntries.length} days shown</span>
          </div>
          <div className="focus-chip">
            <span>{filteredCounts.total} events shown</span>
          </div>
        </div>
      </section>

      {loadError ? (
        <TimelineState
          icon={CircleAlert}
          kicker="Timeline unavailable"
          title="Could not load recent activity."
          description="The local tracker did not return timeline data. Retry once the server and database are ready."
          actionLabel="Retry"
          onAction={() => {
            setLoadError("");
            setIsLoading(true);
            loadTimeline(days, offset)
              .catch((error) => setLoadError(error.message || "Timeline request failed."))
              .finally(() => setIsLoading(false));
          }}
        />
      ) : null}

      {isLoading && !loadError ? (
        <TimelineState
          icon={RefreshCw}
          kicker="Loading"
          title="Collecting recent activity."
          description="Gathering submissions, interviews, stored documents, and follow-up signals."
        />
      ) : null}

      {!isLoading && !loadError && filteredCounts.total === 0 ? (
        <TimelineState
          icon={CalendarRange}
          kicker={timelineEventCount ? "No matching events" : "No activity yet"}
          title={timelineEventCount ? "Nothing matches this filter." : "Timeline activity will appear after the first import."}
          description={
            timelineEventCount
              ? "Switch to All events or choose a wider range to see older tracker movement."
              : "Import roles or update application statuses to build a timeline of decisions and follow-ups."
          }
        />
      ) : null}

      {!isLoading && !loadError && filteredCounts.total > 0 ? (
        <ActivityTimelineBoard
          dayEntries={filteredDayEntries}
          counts={filteredCounts}
          view={timeline.view}
          generatedAt={timeline.generatedAt}
          onStatusChange={handleStatusChange}
          isSubmitting={isSaving}
        />
      ) : null}
    </main>
  );
}
