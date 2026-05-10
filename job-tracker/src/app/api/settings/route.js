import fs from "node:fs";
import path from "node:path";
import { settingsPath } from "@/lib/paths";
import { mergeTrackerSettings } from "@/lib/settings";
import { ensureDir } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readStoredSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  ensureDir(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

export async function GET() {
  return Response.json(mergeTrackerSettings(readStoredSettings()));
}

export async function PATCH(request) {
  try {
    const patch = await request.json();
    const current = mergeTrackerSettings(readStoredSettings());
    const hasSearchSourcesPatch = Object.prototype.hasOwnProperty.call(patch, "searchSources");
    const next = mergeTrackerSettings({
      ...current,
      ...patch,
      workflow: { ...current.workflow, ...(patch.workflow || {}) },
      documents: { ...current.documents, ...(patch.documents || {}) },
      sources: { ...current.sources, ...(patch.sources || {}) },
      searchSources: hasSearchSourcesPatch ? patch.searchSources : current.searchSources,
      candidate: { ...current.candidate, ...(patch.candidate || {}) },
      statusLabels: { ...current.statusLabels, ...(patch.statusLabels || {}) },
    });

    writeSettings(next);
    return Response.json(next);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Settings update failed",
      },
      { status: 400 },
    );
  }
}
