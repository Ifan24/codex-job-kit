import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const manualJobSchema = z.object({
  canonicalUrl: z.url(),
  title: z.string().min(1),
  company: z.string().min(1),
  platform: z.string().optional(),
  location: z.string().optional(),
  workMode: z.string().optional(),
  employmentType: z.string().optional(),
  salaryText: z.string().optional(),
  sourceQuality: z.string().optional(),
  descriptionSummary: z.string().optional(),
  bucket: z.string().optional(),
  fitAssessment: z.string().optional(),
  riskNote: z.string().optional(),
  legitimacyNote: z.string().optional(),
  applicationStatus: z.string().optional(),
  applicationNotes: z.string().optional(),
});

export async function POST(request) {
  const { createManualJob } = await import("@/lib/db");
  const payload = manualJobSchema.parse(await request.json());
  return Response.json(createManualJob(payload), { status: 201 });
}
