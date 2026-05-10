export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function GET(request) {
  const { getTimelineData } = await import("@/lib/db");
  const { searchParams } = new URL(request.url);
  const days = parsePositiveNumber(searchParams.get("days"), 7);
  const offset = parsePositiveNumber(searchParams.get("offset"), 0);

  return Response.json(getTimelineData({ days, offset }));
}
