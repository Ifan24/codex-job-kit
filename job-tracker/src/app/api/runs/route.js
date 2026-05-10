export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { getWorkflowRunsData } = await import("@/lib/db");
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 24);
  return Response.json(getWorkflowRunsData({ limit }));
}
