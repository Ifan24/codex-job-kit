"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarRange, CheckCircle2, Clock3, Layers3, ListFilter, X } from "lucide-react";
import { statusLabels } from "@/lib/statuses";

const DAY_PREVIEW_LIMIT = 4;
const timelineStatusActions = [
  "ready_to_apply",
  "applied",
  "interview",
  "skipped",
  "rejected",
  "closed",
];
const DAY_FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "action_required", label: "Action" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interviews" },
];
const TONE_LEGEND_ITEMS = [
  { tone: "action", label: "Needs action" },
  { tone: "applied", label: "Submitted" },
  { tone: "process", label: "Interview / document" },
  { tone: "rejected", label: "Closed / skipped" },
  { tone: "neutral", label: "Queue / review" },
];
const EVENT_TONES = {
  action_required: "action",
  applied: "applied",
  interview: "process",
  cover_letter: "process",
  prep_done: "process",
  rejected: "rejected",
  closed: "rejected",
  skipped: "rejected",
  queued: "neutral",
  review: "neutral",
};

function eventPriority(event) {
  const rank = {
    action_required: 0,
    interview: 1,
    rejected: 2,
    applied: 3,
    cover_letter: 4,
    prep_done: 5,
    queued: 6,
    review: 7,
    skipped: 8,
    closed: 9,
  };

  return rank[event.kind] ?? 99;
}

function sortEventsForTimeline(events) {
  return [...events].sort((left, right) => {
    const priorityDelta = eventPriority(left) - eventPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
  });
}

function toneClass(tone) {
  return `timeline-tone-${tone || "neutral"}`;
}

function eventTone(event) {
  return EVENT_TONES[event?.kind] || event?.tone || "neutral";
}

function formatEventTime(value) {
  if (!value) return "Time unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatEventDateTime(value) {
  if (!value) return "Date unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function eventTypeLabel(event) {
  return event.title || "Update";
}

function eventKey(event, index) {
  return `${event.jobId}-${event.kind}-${event.occurredAt}-${index}`;
}

function buildDayStats(events) {
  return {
    all: events.length,
    action: events.filter((event) => event.kind === "action_required").length,
    applied: events.filter((event) => event.kind === "applied").length,
    interviews: events.filter((event) => event.kind === "interview").length,
  };
}

function resolvePrimaryActionLabel(event) {
  if (event.kind === "action_required") return "Needs action";
  if (event.kind === "interview") return "Interview";
  if (event.kind === "applied") return "Applied";
  if (event.kind === "cover_letter") return "Document";
  return eventTypeLabel(event);
}

function formatTimelineSummary(event) {
  const summary = event.summary || "";
  const looksLikeLocalPath = /(^|\s)\/?Users\/|job-tracker\/storage|cover_letters|\.(txt|pdf)($|\s)/i.test(summary);

  if (event.kind === "cover_letter" || looksLikeLocalPath) {
    return "Cover letter saved for this role.";
  }

  return summary;
}

function dayFilterCount(optionKey, dayStats) {
  if (optionKey === "all") return dayStats.all;
  if (optionKey === "action_required") return dayStats.action;
  if (optionKey === "applied") return dayStats.applied;
  return dayStats.interviews;
}

function TimelineEventDetails({ event, onStatusChange, isSubmitting }) {
  if (!event) return null;

  return (
    <div className="timeline-event-detail">
      <div className="timeline-event-detail-header">
        <div className={`timeline-event-badge ${toneClass(eventTone(event))}`}>{eventTypeLabel(event)}</div>
        <span className="muted">{formatEventDateTime(event.occurredAt)}</span>
      </div>

      <h3 className="timeline-event-detail-title">{event.jobTitle}</h3>
      <div className="timeline-event-detail-company">{event.company}</div>

      <div className="timeline-event-detail-meta">
        <div className="timeline-event-meta-card">
          <span className="field-label">Tracker status</span>
          <strong>{statusLabels[event.currentStatus || "not_started"] || "Not Started"}</strong>
        </div>
        <div className="timeline-event-meta-card">
          <span className="field-label">Signal</span>
          <strong>{resolvePrimaryActionLabel(event)}</strong>
        </div>
      </div>

      <p className="timeline-event-detail-summary">{formatTimelineSummary(event)}</p>
      {event.notes ? <p className="timeline-event-detail-notes muted">{event.notes}</p> : null}

      <div className="timeline-event-detail-actions">
        {event.jobUrl ? (
          <a className="primary-button" href={event.jobUrl} target="_blank" rel="noreferrer">
            <ArrowUpRight size={16} />
            Open listing
          </a>
        ) : null}
      </div>

      <div className="timeline-event-detail-status">
        <div className="section-titleline">
          <CheckCircle2 size={16} />
          <h4>Quick update</h4>
        </div>
        <div className="timeline-event-status-grid">
          {timelineStatusActions.map((status) => (
            <button
              key={status}
              type="button"
              className={`secondary-button compact-button ${event.currentStatus === status ? "timeline-status-current" : ""}`}
              disabled={isSubmitting}
              onClick={() => onStatusChange?.(event, status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineDayModal({ day, selectedEvent, selectedFilter, onSelectEvent, onFilterChange, onClose, onStatusChange, isSubmitting }) {
  if (!day) return null;

  const filteredEvents =
    selectedFilter === "all"
      ? day.events
      : day.events.filter((event) => event.kind === selectedFilter);
  const dayStats = buildDayStats(day.events);

  return (
    <div className="timeline-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="timeline-day-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-day-modal-title"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <button type="button" className="timeline-modal-close" onClick={onClose} aria-label="Close day details">
          <X size={16} />
        </button>

        <div className="timeline-day-modal-top">
          <div>
            <div className="eyebrow">Daily activity</div>
            <h2 id="timeline-day-modal-title" className="timeline-day-modal-title">
              {day.label}
            </h2>
            <p className="muted timeline-day-modal-copy">
              Review the day, open a listing, or update the role status.
            </p>
          </div>
          <div className="timeline-day-modal-summary">
            <div className="timeline-board-stat">
              <span>Events</span>
              <strong>{day.events.length}</strong>
            </div>
            <div className="timeline-board-stat">
              <span>Needs action</span>
              <strong>{buildDayStats(day.events).action}</strong>
            </div>
          </div>
        </div>

        <div className="timeline-day-filter-bar">
          {DAY_FILTER_OPTIONS.map((option) => {
            const count = dayFilterCount(option.key, dayStats);
            const isDisabled = count === 0;

            return (
              <button
                key={option.key}
                type="button"
                className={`timeline-day-filter-chip ${selectedFilter === option.key ? "is-active" : ""}`}
                aria-pressed={selectedFilter === option.key}
                disabled={isDisabled}
                onClick={() => onFilterChange(option.key)}
              >
                <span>{count}</span>
                <strong>{option.label}</strong>
              </button>
            );
          })}
        </div>

        <div className="timeline-day-modal-layout">
          <div className="timeline-day-event-list">
            {filteredEvents.length ? filteredEvents.map((event, index) => (
              <button
                key={eventKey(event, index)}
                type="button"
                className={`timeline-day-event-row ${selectedEvent === event ? "is-active" : ""} ${toneClass(eventTone(event))}`}
                onClick={() => onSelectEvent(event)}
              >
                <div className="timeline-day-event-row-top">
                  <span className="timeline-event-time">
                    <Clock3 size={12} />
                    {formatEventTime(event.occurredAt)}
                  </span>
                  <span className={`timeline-event-chip ${toneClass(eventTone(event))}`}>{eventTypeLabel(event)}</span>
                </div>
                <div className="timeline-day-event-row-title">{event.jobTitle}</div>
                <div className="timeline-day-event-row-company">{event.company}</div>
              </button>
            )) : (
              <div className="timeline-day-empty">
                No {selectedFilter === "all" ? "" : selectedFilter.replace("_", " ")} events for this day.
              </div>
            )}
          </div>

          <TimelineEventDetails event={selectedEvent} onStatusChange={onStatusChange} isSubmitting={isSubmitting} />
        </div>
      </div>
    </div>
  );
}

export function ActivityTimelineBoard({ dayEntries, counts, view, generatedAt, onStatusChange, isSubmitting = false }) {
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [selectedEventKey, setSelectedEventKey] = useState(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState("all");

  const visibleDays = useMemo(
    () =>
      (dayEntries || []).map((day) => ({
        ...day,
        events: sortEventsForTimeline(day.events || []),
      })),
    [dayEntries],
  );
  const activeDay = useMemo(
    () => visibleDays.find((day) => day.key === selectedDayKey) || null,
    [selectedDayKey, visibleDays],
  );
  const activeEvent = useMemo(() => {
    if (!activeDay) return null;
    const filteredEvents =
      selectedDayFilter === "all"
        ? activeDay.events
        : activeDay.events.filter((event) => event.kind === selectedDayFilter);
    return (
      filteredEvents.find((event, index) => eventKey(event, index) === selectedEventKey) ||
      filteredEvents[0] ||
      null
    );
  }, [activeDay, selectedDayFilter, selectedEventKey]);

  const summary = useMemo(
    () => [
      { label: "Events", value: counts?.total || 0 },
      { label: "Needs action", value: counts?.actionRequired || 0 },
      { label: "Applied", value: counts?.applied || 0 },
      { label: "Interviews", value: counts?.interviews || 0 },
    ],
    [counts],
  );

  function openDay(day, event = null, index = 0, filter = "all") {
    setSelectedDayKey(day.key);
    setSelectedDayFilter(filter);
    if (event) {
      setSelectedEventKey(eventKey(event, index));
    } else {
      const filteredEvents =
        filter === "all" ? day.events : day.events.filter((item) => item.kind === filter);
      setSelectedEventKey(filteredEvents[0] ? eventKey(filteredEvents[0], 0) : null);
    }
  }

  return (
    <>
      <section className="timeline-board-shell">
        <div className="timeline-board-header">
          <div>
            <div className="section-titleline">
              <CalendarRange size={16} />
              <h2>Past {view?.days || visibleDays.length || 7} Days</h2>
            </div>
            <p className="timeline-board-copy">
              Check recent changes, then open the day with the next follow-up.
            </p>
          </div>
          <div className="timeline-board-stats">
            {summary.map((item) => (
              <div key={item.label} className="timeline-board-stat">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="timeline-tone-legend" aria-label="Timeline color legend">
          {TONE_LEGEND_ITEMS.map((item) => (
            <span key={item.tone} className={`timeline-tone-legend-item timeline-tone-${item.tone}`}>
              <span className="timeline-tone-legend-dot" aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>

        <div className="timeline-board-scroll">
          <div className="timeline-board-rail" />
          <div className="timeline-board-grid" style={{ "--timeline-columns": visibleDays.length }}>
            {visibleDays.map((day) => {
              const dayStats = buildDayStats(day.events);
              const previewEvents = day.events.slice(0, DAY_PREVIEW_LIMIT);
              const remainingCount = Math.max(0, day.events.length - previewEvents.length);
              const summaryPills = [
                { key: "action_required", label: "action", value: dayStats.action },
                { key: "applied", label: "applied", value: dayStats.applied },
                { key: "interview", label: "interviews", value: dayStats.interviews },
              ];

              return (
                <section key={day.key} className={`timeline-day-column ${day.isToday ? "is-today" : ""}`}>
                  <header className="timeline-day-column-header">
                    <div className="timeline-day-dot" />
                    <div>
                      <div className="timeline-day-column-label">{day.label}</div>
                      <div className="timeline-day-column-count">
                        <Layers3 size={13} />
                        <span>{day.events.length} events</span>
                      </div>
                    </div>
                  </header>

                  <div className="timeline-day-summary">
                    {summaryPills.map((pill) => (
                      <button
                        key={`${day.key}-${pill.key}`}
                        type="button"
                        className="timeline-day-summary-pill"
                        disabled={pill.value === 0}
                        onClick={() => openDay(day, null, 0, pill.key)}
                      >
                        {pill.value} {pill.label}
                      </button>
                    ))}
                  </div>

                  <div className="timeline-day-stack">
                    {previewEvents.length ? (
                      previewEvents.map((event, index) => (
                        <button
                          key={eventKey(event, index)}
                          type="button"
                          className={`timeline-event-card is-compact ${toneClass(eventTone(event))}`}
                          onClick={() => openDay(day, event, index)}
                        >
                          <div className="timeline-event-card-top">
                            <span className="timeline-event-time">
                              <Clock3 size={12} />
                              {formatEventTime(event.occurredAt)}
                            </span>
                            <span className={`timeline-event-chip ${toneClass(eventTone(event))}`}>{eventTypeLabel(event)}</span>
                          </div>
                          <div className="timeline-event-title">{event.jobTitle}</div>
                          <div className="timeline-event-company">{event.company}</div>
                          <p className="timeline-event-summary">{formatTimelineSummary(event)}</p>
                        </button>
                      ))
                    ) : (
                      <div className="timeline-day-empty">No tracked movement on this day.</div>
                    )}

                    {remainingCount > 0 ? (
                      <button type="button" className="timeline-day-more" onClick={() => openDay(day)}>
                        <ListFilter size={14} />
                        View {remainingCount} more
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="timeline-board-footer">
          <span className="muted">
            Range: {view?.startDate} to {view?.endDate}
          </span>
          <span className="muted">Updated {generatedAt ? formatEventDateTime(generatedAt) : "just now"}</span>
        </div>
      </section>

      <TimelineDayModal
        day={activeDay}
        selectedEvent={activeEvent}
        selectedFilter={selectedDayFilter}
        onSelectEvent={(event) => {
          const index = activeDay?.events.findIndex((item) => item === event) ?? 0;
          setSelectedEventKey(eventKey(event, Math.max(index, 0)));
        }}
        onFilterChange={(filter) => {
          setSelectedDayFilter(filter);
          const filteredEvents =
            filter === "all"
              ? activeDay?.events || []
              : (activeDay?.events || []).filter((event) => event.kind === filter);
          setSelectedEventKey(filteredEvents[0] ? eventKey(filteredEvents[0], 0) : null);
        }}
        onClose={() => {
          setSelectedDayKey(null);
          setSelectedEventKey(null);
          setSelectedDayFilter("all");
        }}
        onStatusChange={async (event, status) => {
          await onStatusChange?.(event, status);
          setSelectedDayKey(null);
          setSelectedEventKey(null);
          setSelectedDayFilter("all");
        }}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
