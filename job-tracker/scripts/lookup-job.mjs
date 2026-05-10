import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { lookupJob } = await import(path.join(trackerRoot, "src/lib/db.js"));

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm lookup-job --url https://example.com/job",
      '  pnpm lookup-job --title "Software Engineer" --company "Example Co"',
      '  pnpm lookup-job --url https://example.com/job --title "Software Engineer" --company "Example Co"',
    ].join("\n"),
  );
}

function getFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
}

const args = process.argv.slice(2);
const canonicalUrl = getFlagValue(args, "--url");
const title = getFlagValue(args, "--title");
const company = getFlagValue(args, "--company");

if (!canonicalUrl && !(title && company)) {
  printUsage();
  process.exit(1);
}

const result = lookupJob({ canonicalUrl, title, company });
console.log(JSON.stringify(result, null, 2));
