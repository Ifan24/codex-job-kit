import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { logApplicationOutcome } = await import(path.join(trackerRoot, "src/lib/db.js"));
const { parseApplicationOutcomePayload } = await import(path.join(trackerRoot, "src/lib/shortlist.js"));

function printUsage() {
  console.error(
    [
      "Usage:",
      "  pnpm log-application /absolute/or/relative/path/to/application-outcome.json",
      "  pnpm log-application --stdin",
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

  const payload = parseApplicationOutcomePayload(JSON.parse(rawInput));
  const result = logApplicationOutcome(payload);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : "Unexpected log-application error",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
