import { ZodError } from "zod";
import { parseShortlistPayload } from "@/lib/shortlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { importShortlist } = await import("@/lib/db");
    const payload = parseShortlistPayload(await request.json());
    return Response.json(importShortlist(payload));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: "Invalid shortlist payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected import error",
      },
      { status: 500 },
    );
  }
}
