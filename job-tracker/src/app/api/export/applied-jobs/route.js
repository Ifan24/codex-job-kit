export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { exportAppliedJobsSnapshot } = await import("@/lib/db");
  return new Response(exportAppliedJobsSnapshot(), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}
