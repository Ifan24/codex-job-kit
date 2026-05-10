import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { getJobDetail } = await import("@/lib/db");
  const { jobId, documentId } = await params;
  const detail = getJobDetail(Number(jobId));

  if (!detail) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  const document = detail.documents.find((item) => item.id === Number(documentId));
  if (!document?.file_path || !fs.existsSync(document.file_path)) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(document.file_path);
  const extension = path.extname(document.file_path).toLowerCase();
  const contentType = extension === ".pdf" ? "application/pdf" : "text/plain; charset=utf-8";

  return new Response(fileBuffer, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${path.basename(document.file_path)}"`,
    },
  });
}
