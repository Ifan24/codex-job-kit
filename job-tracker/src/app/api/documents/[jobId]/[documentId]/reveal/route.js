import { execFileSync } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { getJobDetail } = await import("@/lib/db");
  const { jobId, documentId } = await params;
  const detail = getJobDetail(Number(jobId));

  if (!detail) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  const document = detail.documents.find((item) => item.id === Number(documentId));
  if (!document?.file_path) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    execFileSync("open", ["-R", document.file_path]);
    return Response.json({ ok: true, filePath: document.file_path });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to reveal document",
      },
      { status: 500 },
    );
  }
}
