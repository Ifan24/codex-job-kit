import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  canonicalUrl: z.string().url().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
});

export async function GET(request) {
  const { lookupJob } = await import("@/lib/db");
  const searchParams = request.nextUrl.searchParams;
  const payload = lookupSchema.parse({
    canonicalUrl: searchParams.get("canonicalUrl") || undefined,
    title: searchParams.get("title") || undefined,
    company: searchParams.get("company") || undefined,
  });

  return Response.json(lookupJob(payload));
}
