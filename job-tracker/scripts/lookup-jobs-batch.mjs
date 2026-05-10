import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { lookupJobsBatch } = await import(path.join(trackerRoot, "src/lib/db.js"));

const lookupItemSchema = z.object({
  sourceId: z.string().optional(),
  url: z.string().url().optional(),
  postingUrl: z.string().url().optional(),
  canonicalUrl: z.string().url().optional(),
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  location: z.string().optional().default(""),
});

const inputSchema = z.union([
  z.array(lookupItemSchema),
  z.object({
    jobs: z.array(lookupItemSchema).default([]),
  }),
]);

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm lookup-jobs-batch /absolute/or/relative/path/to/jobs.json",
      "  pnpm lookup-jobs-batch --stdin",
      "",
      "Input shapes:",
      '  [{"sourceId":"1","title":"Software Engineer","company":"Example Co"}]',
      '  {"jobs":[{"sourceId":"1","title":"Software Engineer","company":"Example Co"}]}',
    ].join("\n"),
  );
}

async function readFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeInput(input) {
  const parsed = inputSchema.parse(input);
  return Array.isArray(parsed) ? parsed : parsed.jobs;
}

async function main() {
  const args = process.argv.slice(2);
  const useStdin = args.includes("--stdin");
  const fileArg = args.find((arg) => !arg.startsWith("--"));

  if (!useStdin && !fileArg) {
    printUsage();
    process.exit(1);
  }

  const rawInput = useStdin
    ? await readFromStdin()
    : fs.readFileSync(path.resolve(process.cwd(), fileArg), "utf8");

  const jobs = normalizeInput(JSON.parse(rawInput));
  const results = lookupJobsBatch(jobs);

  console.log(
    JSON.stringify(
      {
        count: results.length,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : "Unexpected batch lookup error",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
