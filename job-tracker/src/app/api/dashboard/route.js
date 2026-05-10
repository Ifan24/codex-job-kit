export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { getDashboardData } = await import("@/lib/db");
  return Response.json(getDashboardData());
}
