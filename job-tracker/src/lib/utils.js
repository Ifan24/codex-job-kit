import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function extractCoverLetterText(texContent) {
  const bodyStart = texContent.indexOf("Dear Hiring Team,");
  const bodyEnd = texContent.indexOf("\\vspace{15pt}");

  if (bodyStart === -1 || bodyEnd === -1) {
    return texContent;
  }

  return texContent
    .slice(bodyStart, bodyEnd)
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{\\uline\{([^}]*)\}\}/g, "$1")
    .replace(/\\today/g, "")
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolveIfExists(...parts) {
  const filePath = path.join(...parts);
  return fileExists(filePath) ? filePath : null;
}
