import { getLanePerformanceData } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 7);

  return Response.json(getLanePerformanceData({ limit }));
}
