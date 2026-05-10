import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.string().optional(),
  appliedAt: z.string().nullable().optional(),
  notes: z.string().optional(),
  checklistJson: z.string().optional(),
});

export async function GET(_request, { params }) {
  const { getJobDetail } = await import("@/lib/db");
  const { jobId } = await params;
  const detail = getJobDetail(Number(jobId));

  if (!detail) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json(detail);
}

export async function PATCH(request, { params }) {
  const { upsertApplication } = await import("@/lib/db");
  const { jobId } = await params;
  const payload = patchSchema.parse(await request.json());
  return Response.json(upsertApplication(Number(jobId), payload));
}
