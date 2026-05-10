import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackerRoot = path.resolve(scriptDir, "..");

const { getLanePerformanceData } = await import(path.join(trackerRoot, "src/lib/db.js"));

function getFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function main() {
  const args = process.argv.slice(2);
  const limit = Number(getFlagValue(args, "--limit") || 7);
  const data = getLanePerformanceData({ limit });
  console.log(JSON.stringify(data, null, 2));
}

main();
