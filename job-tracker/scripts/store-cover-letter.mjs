import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { getJobDetail, storeCoverLetterAssets } = await import(path.join(trackerRoot, "src/lib/db.js"));
const { coverLettersRoot } = await import(path.join(trackerRoot, "src/lib/paths.js"));
const { ensureDir, fileExists, slugify } = await import(path.join(trackerRoot, "src/lib/utils.js"));

function printUsage() {
  console.error(
    [
      "Usage:",
      '  pnpm store-cover-letter --job-id 123 --text-file "/path/to/cover-letter.txt" [--pdf-file "/path/to/cover-letter.pdf"]',
    ].join("\n"),
  );
}

function getFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function copyIntoTrackerStorage(job, sourcePath, kind) {
  if (!sourcePath) return null;
  if (!fileExists(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const folderName = `job-${job.id}-${slugify(`${job.company}-${job.title}`) || "cover-letter"}`;
  const targetDir = path.join(coverLettersRoot, folderName);
  ensureDir(targetDir);

  const extension = path.extname(sourcePath) || (kind === "text" ? ".txt" : ".pdf");
  const targetPath = path.join(targetDir, kind === "text" ? `cover-letter${extension}` : `cover-letter${extension}`);

  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedSource !== resolvedTarget) {
    fs.copyFileSync(resolvedSource, resolvedTarget);
  }

  return targetPath;
}

const args = process.argv.slice(2);
const jobId = Number(getFlagValue(args, "--job-id"));
const textFile = getFlagValue(args, "--text-file");
const pdfFile = getFlagValue(args, "--pdf-file");

if (!jobId || !textFile) {
  printUsage();
  process.exit(1);
}

const job = getJobDetail(jobId);
if (!job) {
  console.error(JSON.stringify({ error: `Job not found: ${jobId}` }, null, 2));
  process.exit(1);
}

const storedTextPath = copyIntoTrackerStorage(job, textFile, "text");
const storedPdfPath = pdfFile ? copyIntoTrackerStorage(job, pdfFile, "pdf") : null;

const result = storeCoverLetterAssets({
  jobId,
  textFilePath: storedTextPath,
  pdfFilePath: storedPdfPath,
});

console.log(
  JSON.stringify(
    {
      jobId,
      title: job.title,
      company: job.company,
      storedTextPath,
      storedPdfPath,
      documents: result.documents,
    },
    null,
    2,
  ),
);
