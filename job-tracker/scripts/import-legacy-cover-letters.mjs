import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { getDashboardData, storeCoverLetterAssets } = await import(path.join(trackerRoot, "src/lib/db.js"));
const { coverLettersRoot } = await import(path.join(trackerRoot, "src/lib/paths.js"));
const { ensureDir, extractCoverLetterText, fileExists, normalizeForMatch, slugify } = await import(path.join(trackerRoot, "src/lib/utils.js"));

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm import-legacy-cover-letters /absolute/or/relative/path/to/cover_letters",
    ].join("\n"),
  );
}

function firstMatchingFile(dir, extensions) {
  if (!fileExists(dir)) return null;
  const files = fs.readdirSync(dir).sort();
  const match = files.find((file) => extensions.includes(path.extname(file).toLowerCase()));
  return match ? path.join(dir, match) : null;
}

function flattenJobs(grouped) {
  return Object.values(grouped || {}).flat();
}

function findJobForFolder(jobs, folderName) {
  const folderNorm = normalizeForMatch(folderName);

  return jobs.find((job) => {
    const companyNorm = normalizeForMatch(job.company);
    const titleNorm = normalizeForMatch(job.title);
    if (!companyNorm || !folderNorm.includes(companyNorm)) return false;
    if (!titleNorm) return true;
    return folderNorm.includes(titleNorm.slice(0, Math.min(titleNorm.length, 8)));
  });
}

function prepareTextFile(job, sourcePath) {
  if (!sourcePath) return null;

  const folderName = `job-${job.id}-${slugify(`${job.company}-${job.title}`) || "cover-letter"}`;
  const targetDir = path.join(coverLettersRoot, folderName);
  ensureDir(targetDir);

  const extension = path.extname(sourcePath).toLowerCase();
  const targetPath = path.join(targetDir, "cover-letter.txt");
  const rawContent = fs.readFileSync(sourcePath, "utf8");
  const textContent = extension === ".tex" ? extractCoverLetterText(rawContent) : rawContent;
  fs.writeFileSync(targetPath, textContent, "utf8");

  return targetPath;
}

function copyPdfFile(job, sourcePath) {
  if (!sourcePath) return null;

  const folderName = `job-${job.id}-${slugify(`${job.company}-${job.title}`) || "cover-letter"}`;
  const targetDir = path.join(coverLettersRoot, folderName);
  ensureDir(targetDir);

  const targetPath = path.join(targetDir, "cover-letter.pdf");
  fs.copyFileSync(sourcePath, targetPath);
  return targetPath;
}

const dirArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!dirArg) {
  printUsage();
  process.exit(1);
}

const legacyDir = path.resolve(process.cwd(), dirArg);
if (!fileExists(legacyDir)) {
  console.error(JSON.stringify({ error: `Directory not found: ${legacyDir}` }, null, 2));
  process.exit(1);
}

const jobs = flattenJobs(getDashboardData().grouped);
const folders = fs.readdirSync(legacyDir).filter((item) => fileExists(path.join(legacyDir, item)));
const summary = {
  legacyDir,
  scannedFolders: folders.length,
  attached: 0,
  unmatched: [],
};

for (const folder of folders) {
  const folderPath = path.join(legacyDir, folder);
  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) continue;

  const job = findJobForFolder(jobs, folder);
  if (!job) {
    summary.unmatched.push(folder);
    continue;
  }

  const textSource = firstMatchingFile(folderPath, [".txt", ".tex"]);
  const pdfSource = firstMatchingFile(folderPath, [".pdf"]);
  if (!textSource) {
    summary.unmatched.push(folder);
    continue;
  }

  const textFilePath = prepareTextFile(job, textSource);
  const pdfFilePath = copyPdfFile(job, pdfSource);
  storeCoverLetterAssets({
    jobId: job.id,
    textFilePath,
    pdfFilePath,
  });
  summary.attached += 1;
}

console.log(JSON.stringify(summary, null, 2));
