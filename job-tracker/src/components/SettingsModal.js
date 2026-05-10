"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ExternalLink, Plus, RefreshCw, Save, Settings, SlidersHorizontal, Trash2, X } from "lucide-react";

const tabs = [
  { id: "documents", label: "Documents" },
  { id: "sources", label: "Sources" },
  { id: "fit", label: "Fit" },
];

const baseSourceOrder = ["linkedin", "seek", "ats", "jora", "indeed"];
const baseSourceSet = new Set(baseSourceOrder);

const sourceFallbackLabels = {
  linkedin: "LinkedIn",
  seek: "SEEK",
  ats: "ATS",
  jora: "Jora",
  indeed: "Indeed",
};

const tierOptions = [
  { value: "primary", label: "Primary" },
  { value: "supplemental", label: "Supplemental" },
  { value: "disabled", label: "Disabled" },
];

const executionOptions = [
  { value: "cookie_shared_isolated", label: "Cookie-shared worker" },
  { value: "single_owner_connected_browser", label: "Single-owner browser" },
  { value: "direct_http_or_browser", label: "HTTP or browser" },
];

const workModeLabels = {
  hybrid: "Hybrid",
  remote: "Remote",
  onsite: "On-site",
};

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="settings-toggle-row">
      <span>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SegmentedChoice({ value, options, onChange }) {
  return (
    <div className="settings-segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "is-active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function makeSourceId(label, existingIds) {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let id = base || "custom-source";
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${base || "custom-source"}-${suffix}`;
    suffix += 1;
  }

  return id;
}

export default function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedSource, setSelectedSource] = useState("linkedin");
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(draft), [draft, settings]);
  const searchSourceKeys = useMemo(() => {
    if (!draft?.searchSources) return baseSourceOrder;
    const keys = Object.keys(draft.searchSources);
    const baseKeys = baseSourceOrder.filter((source) => keys.includes(source));
    const customKeys = keys.filter((source) => !baseSourceSet.has(source)).sort();
    return [...baseKeys, ...customKeys];
  }, [draft]);
  const selectedSourceConfig = draft?.searchSources?.[selectedSource] || null;

  async function loadSettings() {
    setStatus("");
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Settings request failed.");
    }
    setSettings(data);
    setDraft(data);
  }

  useEffect(() => {
    if (!isOpen || draft) return;
    loadSettings().catch((error) => setStatus(error.message || "Settings request failed."));
  }, [draft, isOpen]);

  useEffect(() => {
    if (!draft?.searchSources?.[selectedSource]) {
      setSelectedSource(searchSourceKeys.find((source) => draft?.searchSources?.[source]) || "linkedin");
    }
  }, [draft, searchSourceKeys, selectedSource]);

  function updateDraft(section, patch) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...patch,
      },
    }));
  }

  function toggleWorkMode(mode, checked) {
    const currentModes = new Set(draft.candidate.workModes || []);
    if (checked) {
      currentModes.add(mode);
    } else {
      currentModes.delete(mode);
    }
    updateDraft("candidate", { workModes: Array.from(currentModes) });
  }

  function updateSearchSource(source, patch) {
    setDraft((current) => ({
      ...current,
      searchSources: {
        ...current.searchSources,
        [source]: {
          ...current.searchSources[source],
          ...patch,
        },
      },
      sources: {
        ...current.sources,
        [source]: Boolean(patch.enabled ?? current.searchSources[source].enabled),
      },
    }));
  }

  function toggleSource(source, enabled) {
    updateSearchSource(source, {
      enabled,
      tier: enabled ? (draft.searchSources[source].tier === "disabled" ? "supplemental" : draft.searchSources[source].tier) : "disabled",
    });
  }

  function addSearchSource() {
    if (!draft?.searchSources) return;

    const sourceNumber = Object.keys(draft.searchSources).filter((source) => !baseSourceSet.has(source)).length + 1;
    const label = `Custom source ${sourceNumber}`;
    const source = makeSourceId(label, new Set(Object.keys(draft.searchSources)));

    setDraft((current) => ({
      ...current,
      searchSources: {
        ...current.searchSources,
        [source]: {
          label,
          enabled: true,
          tier: "supplemental",
          executionMode: "direct_http_or_browser",
          authCheckUrl: "",
          maxPages: 1,
          notes: "",
          lanes: [
            {
              id: `${source}-lane-1`,
              label: "Search lane 1",
              kind: "url",
              value: "",
            },
          ],
        },
      },
      sources: {
        ...current.sources,
        [source]: true,
      },
    }));
    setSelectedSource(source);
  }

  function removeSearchSource(source) {
    if (baseSourceSet.has(source)) return;

    setDraft((current) => {
      const { [source]: removedSearchSource, ...nextSearchSources } = current.searchSources;
      const { [source]: removedSource, ...nextSources } = current.sources;
      void removedSearchSource;
      void removedSource;

      return {
        ...current,
        searchSources: nextSearchSources,
        sources: nextSources,
      };
    });
    setSelectedSource(searchSourceKeys.find((candidate) => candidate !== source) || "linkedin");
  }

  function updateSourceLane(source, index, patch) {
    setDraft((current) => {
      const currentSource = current.searchSources[source];
      const lanes = currentSource.lanes.map((lane, laneIndex) => (laneIndex === index ? { ...lane, ...patch } : lane));

      return {
        ...current,
        searchSources: {
          ...current.searchSources,
          [source]: {
            ...currentSource,
            lanes,
          },
        },
      };
    });
  }

  function addSourceLane(source) {
    setDraft((current) => {
      const currentSource = current.searchSources[source];
      const nextIndex = currentSource.lanes.length + 1;

      return {
        ...current,
        searchSources: {
          ...current.searchSources,
          [source]: {
            ...currentSource,
            lanes: [
              ...currentSource.lanes,
              {
                id: `${source}-custom-${nextIndex}`,
                label: `Custom lane ${nextIndex}`,
                kind: "url",
                value: "",
              },
            ],
          },
        },
      };
    });
  }

  function removeSourceLane(source, index) {
    setDraft((current) => {
      const currentSource = current.searchSources[source];

      return {
        ...current,
        searchSources: {
          ...current.searchSources,
          [source]: {
            ...currentSource,
            lanes: currentSource.lanes.filter((_, laneIndex) => laneIndex !== index),
          },
        },
      };
    });
  }

  async function saveSettings() {
    try {
      setIsSaving(true);
      setStatus("");
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Settings update failed.");
      }
      setSettings(data);
      setDraft(data);
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error.message || "Settings update failed.");
    } finally {
      setIsSaving(false);
    }
  }

  const settingsDialog =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
            <section
              className="settings-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="settings-modal-header">
                <div>
                  <div className="eyebrow">Tracker settings</div>
                  <h2 id="settings-modal-title">Workflow Controls</h2>
                </div>
                <button type="button" className="timeline-modal-close" onClick={() => setIsOpen(false)} aria-label="Close settings">
                  <X size={16} />
                </button>
              </header>

              <div className="settings-modal-body">
                <aside className="settings-tabs" aria-label="Settings sections">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={activeTab === tab.id ? "is-active" : ""}
                      aria-pressed={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </aside>

                <div className="settings-content">
                  {!draft ? (
                    <div className="settings-loading">
                      <RefreshCw size={16} />
                      Loading settings
                    </div>
                  ) : null}

                  {draft && activeTab === "documents" ? (
                    <div className="settings-section">
                      <div className="settings-section-heading">
                        <SlidersHorizontal size={16} />
                        <h3>Document generation</h3>
                      </div>
                      <ToggleRow
                        label="Generate cover letters"
                        description="Daily shortlist stores text and PDF cover letters for recommend roles."
                        checked={draft.documents.generateCoverLetters}
                        onChange={(value) => updateDraft("documents", { generateCoverLetters: value })}
                      />
                      <ToggleRow
                        label="Tailor resume"
                        description="Workflow may prepare resume changes when a role is strong enough."
                        checked={draft.documents.tailorResume}
                        onChange={(value) => updateDraft("documents", { tailorResume: value })}
                      />
                      <ToggleRow
                        label="Fallback prompts"
                        description="Keep copyable prompts available when a stored document is missing."
                        checked={draft.documents.includeFallbackPrompt}
                        onChange={(value) => updateDraft("documents", { includeFallbackPrompt: value })}
                      />
                    </div>
                  ) : null}

                  {draft && activeTab === "sources" ? (
                    <div className="settings-section">
                      <div className="settings-section-heading settings-section-heading-spread">
                        <div>
                          <SlidersHorizontal size={16} />
                          <h3>Search sources</h3>
                        </div>
                        <button type="button" className="secondary-button compact-button" onClick={addSearchSource}>
                          <Plus size={15} />
                          Add source
                        </button>
                      </div>

                      <div className="settings-sources-layout">
                        <div className="settings-source-picker" aria-label="Configured job sources">
                          {searchSourceKeys.map((source) => {
                            const sourceConfig = draft.searchSources[source];
                            const label = sourceConfig?.label || sourceFallbackLabels[source] || source;
                            const isSelected = selectedSource === source;

                            return (
                              <div key={source} className={`settings-source-picker-card ${isSelected ? "is-selected" : ""}`}>
                                <label className="settings-source-picker-toggle">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sourceConfig?.enabled)}
                                    onChange={(event) => toggleSource(source, event.target.checked)}
                                  />
                                  {sourceConfig?.enabled ? <Check size={14} /> : null}
                                </label>
                                <button type="button" onClick={() => setSelectedSource(source)} aria-pressed={isSelected}>
                                  <span className="settings-source-picker-label">{label}</span>
                                  <span className="settings-source-picker-meta">
                                    {sourceConfig?.enabled ? sourceConfig.tier : "disabled"} · {sourceConfig?.lanes?.length || 0} lanes
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {selectedSourceConfig ? (
                          <section className={`settings-source-editor ${selectedSourceConfig.enabled ? "is-enabled" : ""}`}>
                          <div className="settings-source-editor-header">
                            <label className="settings-source-title">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedSourceConfig.enabled)}
                                onChange={(event) => toggleSource(selectedSource, event.target.checked)}
                              />
                              <span>
                                <strong>{selectedSourceConfig.label}</strong>
                                <span>
                                  {selectedSourceConfig.enabled ? `${selectedSourceConfig.tier} · ${selectedSourceConfig.lanes.length} lanes` : "disabled"}
                                </span>
                              </span>
                            </label>
                            {selectedSourceConfig.authCheckUrl ? (
                              <a className="secondary-button compact-button" href={selectedSourceConfig.authCheckUrl} target="_blank" rel="noreferrer">
                                <ExternalLink size={15} />
                                Open source
                              </a>
                            ) : null}
                          </div>

                          <label className="settings-field">
                            <span>Source name</span>
                            <input
                              type="text"
                              value={selectedSourceConfig.label}
                              onChange={(event) => updateSearchSource(selectedSource, { label: event.target.value })}
                            />
                          </label>

                          <div className="settings-source-fields">
                            <label className="settings-field">
                              <span>Tier</span>
                              <select
                                value={selectedSourceConfig.tier}
                                onChange={(event) =>
                                  updateSearchSource(selectedSource, {
                                    tier: event.target.value,
                                    enabled: event.target.value !== "disabled",
                                  })
                                }
                              >
                                {tierOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="settings-field">
                              <span>Execution</span>
                              <select
                                value={selectedSourceConfig.executionMode}
                                onChange={(event) => updateSearchSource(selectedSource, { executionMode: event.target.value })}
                              >
                                {executionOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="settings-field compact">
                              <span>Max pages</span>
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={selectedSourceConfig.maxPages}
                                onChange={(event) => updateSearchSource(selectedSource, { maxPages: Number(event.target.value) })}
                              />
                            </label>
                          </div>

                          <div className="settings-lane-header">
                            <div>
                              <strong>Search lanes</strong>
                              <span>URLs open directly. Queries are entered into the source search UI.</span>
                            </div>
                            <button type="button" className="secondary-button compact-button" onClick={() => addSourceLane(selectedSource)}>
                              <Plus size={15} />
                              Add lane
                            </button>
                          </div>

                          <div className="settings-lane-list">
                            {selectedSourceConfig.lanes.length ? (
                              selectedSourceConfig.lanes.map((lane, laneIndex) => (
                                <div key={lane.id || laneIndex} className="settings-lane-card">
                                  <div className="settings-lane-row">
                                    <label className="settings-field">
                                      <span>Lane name</span>
                                      <input
                                        type="text"
                                        value={lane.label}
                                        onChange={(event) => updateSourceLane(selectedSource, laneIndex, { label: event.target.value })}
                                      />
                                    </label>
                                    <label className="settings-field compact">
                                      <span>Type</span>
                                      <select
                                        value={lane.kind}
                                        onChange={(event) => updateSourceLane(selectedSource, laneIndex, { kind: event.target.value })}
                                      >
                                        <option value="url">URL</option>
                                        <option value="query">Query</option>
                                      </select>
                                    </label>
                                    <label className="settings-field lane-value">
                                      <span>{lane.kind === "query" ? "Search query" : "Search URL"}</span>
                                      <input
                                        type={lane.kind === "url" ? "url" : "text"}
                                        value={lane.value}
                                        spellCheck={false}
                                        onChange={(event) => updateSourceLane(selectedSource, laneIndex, { value: event.target.value })}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="icon-only-button"
                                      onClick={() => removeSourceLane(selectedSource, laneIndex)}
                                      aria-label={`Remove ${lane.label}`}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="settings-empty-lanes">
                                No lanes configured for this source.
                                <button type="button" className="secondary-button compact-button" onClick={() => addSourceLane(selectedSource)}>
                                  <Plus size={15} />
                                  Add lane
                                </button>
                              </div>
                            )}
                          </div>

                          <label className="settings-field">
                            <span>Auth or source URL</span>
                            <input
                              type="url"
                              value={selectedSourceConfig.authCheckUrl}
                              placeholder="https://..."
                              onChange={(event) => updateSearchSource(selectedSource, { authCheckUrl: event.target.value })}
                            />
                          </label>

                          <label className="settings-field">
                            <span>Source-specific notes</span>
                            <textarea
                              className="settings-notes-textarea"
                              value={selectedSourceConfig.notes}
                              onChange={(event) => updateSearchSource(selectedSource, { notes: event.target.value })}
                            />
                          </label>

                          {!baseSourceSet.has(selectedSource) ? (
                            <button type="button" className="secondary-button compact-button danger-button" onClick={() => removeSearchSource(selectedSource)}>
                              <Trash2 size={15} />
                              Remove source
                            </button>
                          ) : null}
                          </section>
                        ) : null}
                      </div>
                      <ToggleRow
                        label="Require live verification"
                        description="Keep browser or direct-page checks before importing high-priority roles."
                        checked={draft.workflow.requireLiveVerification}
                        onChange={(value) => updateDraft("workflow", { requireLiveVerification: value })}
                      />
                    </div>
                  ) : null}

                  {draft && activeTab === "fit" ? (
                    <div className="settings-section">
                      <div className="settings-section-heading">
                        <SlidersHorizontal size={16} />
                        <h3>Fit defaults</h3>
                      </div>
                      <label className="settings-field">
                        <span>Preferred location</span>
                        <input
                          type="text"
                          value={draft.candidate.preferredLocation}
                          onChange={(event) => updateDraft("candidate", { preferredLocation: event.target.value })}
                        />
                      </label>
                      <div className="settings-field">
                        <span>Work modes</span>
                        <div className="settings-source-grid compact">
                          {Object.entries(workModeLabels).map(([mode, label]) => (
                            <label key={mode} className="settings-source-card">
                              <input
                                type="checkbox"
                                checked={(draft.candidate.workModes || []).includes(mode)}
                                onChange={(event) => toggleWorkMode(mode, event.target.checked)}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="settings-field">
                        <span>Seniority target</span>
                        <SegmentedChoice
                          value={draft.candidate.seniority}
                          options={[
                            { value: "early_career", label: "0-3 years" },
                            { value: "mid_level", label: "Mid" },
                            { value: "stretch", label: "Stretch" },
                          ]}
                          onChange={(value) => updateDraft("candidate", { seniority: value })}
                        />
                      </div>
                      <ToggleRow
                        label="Include borderline roles"
                        description="Keep credible stretch or partial-fit roles in the review-later lane."
                        checked={draft.workflow.includeBorderlineRoles}
                        onChange={(value) => updateDraft("workflow", { includeBorderlineRoles: value })}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <footer className="settings-modal-footer">
                <div className="settings-status" role="status" aria-live="polite">
                  {status || (isDirty ? "Unsaved changes" : "Settings are current")}
                </div>
                <div className="settings-footer-actions">
                  <button type="button" className="secondary-button compact-button" onClick={() => setDraft(settings)} disabled={!isDirty || isSaving}>
                    Reset
                  </button>
                  <button type="button" className="primary-button compact-button" onClick={saveSettings} disabled={!isDirty || isSaving || !draft}>
                    <Save size={16} />
                    {isSaving ? "Saving" : "Save settings"}
                  </button>
                </div>
              </footer>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button type="button" className="tracker-nav-icon-button" onClick={() => setIsOpen(true)} aria-label="Open settings">
        <Settings size={17} />
      </button>

      {settingsDialog}
    </>
  );
}
