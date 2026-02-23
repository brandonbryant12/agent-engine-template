#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { runScript } from "../lib/effect-script";

const ROOT = process.cwd();
const CANONICAL_SKILLS_DIR = path.join(ROOT, ".agents", "skills");
const MIRROR_SKILL_DIRS = [
  path.join(ROOT, ".claude", "skills"),
  path.join(ROOT, ".agent", "skills"),
  path.join(ROOT, ".github", "skills"),
];

const REQUIRED_FRONTMATTER_KEYS = ["name", "description"];
const OUTPUT_HEADING_PATTERNS = [
  /^##\s+Output Contract\b/m,
  /^##\s+Required Output\b/m,
  /^##\s+Handoff Output Contract\b/m,
  /^##\s+Review Checklist\b/m,
];
const PROCEDURAL_HEADING_PATTERNS = [
  /^##\s+.*\b(Steps?|Flow|Loop|Cadence|Checklist)\b/m,
  /^##\s+\d+\)/m,
  /^##\s+\d+\./m,
];
const MEMORY_MARKERS = ["No standalone memory key"];
const BANNED_REFERENCES = ["react-doctor"];
const PATH_PREFIXES = [
  "apps/",
  "packages/",
  "docs/",
  "agent-engine/scripts/",
  "tools/",
  ".agents/",
  ".agent/",
  ".claude/",
  ".github/",
];
const MAX_RECOMMENDED_LINES = 120;
const MIN_CONCRETE_PATH_ANCHORS = 2;

const USAGE = `Usage:
  pnpm skills:check [--strict] [--json]

Options:
  --strict  Treat warnings as failures (non-zero exit code)
  --json    Print machine-readable JSON output
`;

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }
  return {
    strict: flags.has("--strict"),
    json: flags.has("--json"),
  };
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, "");
}

function getFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const parsed = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (!parsed) continue;
    data[parsed[1]] = stripQuotes(parsed[2].trim());
  }
  return data;
}

function looksLikeConcretePath(token) {
  if (!token) return false;
  if (token.includes(" ")) return false;
  if (token.startsWith("http://") || token.startsWith("https://")) return false;
  if (token.startsWith("@")) return false;
  return PATH_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function shouldSkipPathCheck(token) {
  return (
    /[\*\{\}\[\]\|]/.test(token) ||
    token.includes("...") ||
    token.includes("$") ||
    token.includes("YYYY-MM") ||
    token.includes("(") ||
    token.includes(")")
  );
}

function normalizePathToken(token) {
  return token.replace(/^[('"`]+|[)"'`.,:;]+$/g, "");
}

async function pathExists(candidatePath) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function addIssue(issues, level, message, filePath) {
  issues.push({ level, message, filePath });
}

async function getSkillDirs() {
  const entries = await fs.readdir(CANONICAL_SKILLS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

async function validateSkillFile(skillName, issues) {
  const skillPath = path.join(CANONICAL_SKILLS_DIR, skillName, "SKILL.md");
  if (!(await pathExists(skillPath))) {
    addIssue(issues, "error", "Missing SKILL.md", skillPath);
    return;
  }

  const content = await fs.readFile(skillPath, "utf8");
  const frontmatter = getFrontmatter(content);

  if (!frontmatter) {
    addIssue(issues, "error", "Missing YAML frontmatter", skillPath);
  } else {
    for (const key of REQUIRED_FRONTMATTER_KEYS) {
      if (!frontmatter[key] || !frontmatter[key].trim()) {
        addIssue(issues, "error", `Missing frontmatter key: ${key}`, skillPath);
      }
    }
    if (frontmatter.name && frontmatter.name !== skillName) {
      addIssue(
        issues,
        "error",
        `Frontmatter name '${frontmatter.name}' does not match directory '${skillName}'`,
        skillPath,
      );
    }
  }

  if (!/^#\s+\S/m.test(content)) {
    addIssue(issues, "error", "Missing top-level heading (# ...)", skillPath);
  }

  if (!OUTPUT_HEADING_PATTERNS.some((pattern) => pattern.test(content))) {
    addIssue(
      issues,
      "warning",
      "Missing output/checklist heading",
      skillPath,
    );
  }

  if (!PROCEDURAL_HEADING_PATTERNS.some((pattern) => pattern.test(content))) {
    addIssue(
      issues,
      "warning",
      "Missing procedural section heading (e.g., Steps/Flow/Loop or numbered phase headings)",
      skillPath,
    );
  }

  const hasMemoryGuidance =
    MEMORY_MARKERS.some((marker) => content.includes(marker)) ||
    (content.includes("workflow-memory") &&
      (content.includes("workflow-memory:add-entry") ||
        content.includes("add-entry.ts") ||
        content.includes("add-entry.mjs")));

  if (!hasMemoryGuidance) {
    addIssue(issues, "warning", "Missing memory guidance section", skillPath);
  }

  for (const token of BANNED_REFERENCES) {
    if (content.includes(token)) {
      addIssue(issues, "error", `Banned stale reference found: ${token}`, skillPath);
    }
  }

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > MAX_RECOMMENDED_LINES) {
    addIssue(
      issues,
      "warning",
      `Skill length ${lineCount} lines exceeds recommended ${MAX_RECOMMENDED_LINES}`,
      skillPath,
    );
  }

  const concretePathAnchors = new Set();
  for (const match of content.matchAll(/`([^`\n]+)`/g)) {
    const raw = normalizePathToken(match[1].trim());
    if (!looksLikeConcretePath(raw)) continue;
    concretePathAnchors.add(raw);
    if (shouldSkipPathCheck(raw)) continue;

    const absolutePath = path.join(ROOT, raw);
    if (!(await pathExists(absolutePath))) {
      addIssue(issues, "warning", `Referenced path does not exist: ${raw}`, skillPath);
    }
  }

  if (concretePathAnchors.size < MIN_CONCRETE_PATH_ANCHORS) {
    addIssue(
      issues,
      "warning",
      `Insufficient concrete path anchors (${concretePathAnchors.size}); add at least ${MIN_CONCRETE_PATH_ANCHORS} repository paths`,
      skillPath,
    );
  }
}

async function validateMirrors(skillNames, issues) {
  const expectedSet = new Set(skillNames);

  for (const mirrorDir of MIRROR_SKILL_DIRS) {
    if (!(await pathExists(mirrorDir))) {
      addIssue(issues, "error", "Mirror skills directory missing", mirrorDir);
      continue;
    }

    const entries = await fs.readdir(mirrorDir, { withFileTypes: true });
    const entryNames = entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();

    for (const name of entryNames) {
      if (!expectedSet.has(name)) {
        addIssue(
          issues,
          "error",
          `Unexpected mirror entry not in canonical skills: ${name}`,
          path.join(mirrorDir, name),
        );
      }
    }

    for (const skillName of skillNames) {
      const mirrorPath = path.join(mirrorDir, skillName);
      if (!(await pathExists(mirrorPath))) {
        addIssue(issues, "error", `Missing mirror entry for skill: ${skillName}`, mirrorPath);
        continue;
      }

      const stats = await fs.lstat(mirrorPath);
      if (!stats.isSymbolicLink()) {
        addIssue(issues, "error", `Mirror entry is not a symlink: ${skillName}`, mirrorPath);
        continue;
      }

      const target = await fs.readlink(mirrorPath);
      const expectedTarget = `../../.agents/skills/${skillName}`;
      if (target !== expectedTarget) {
        addIssue(
          issues,
          "warning",
          `Mirror symlink target mismatch for ${skillName}: expected ${expectedTarget}, found ${target}`,
          mirrorPath,
        );
      }
    }
  }
}

function summarizeIssues(issues) {
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;
  return { errors, warnings };
}

function printHumanReport(skillCount, issues, strict) {
  const { errors, warnings } = summarizeIssues(issues);
  console.log(`Skill quality check complete: ${skillCount} skills scanned`);
  console.log(`Errors: ${errors}`);
  console.log(`Warnings: ${warnings}`);
  console.log(`Mode: ${strict ? "strict" : "default"}`);

  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }

  for (const issue of issues.sort((a, b) => a.filePath.localeCompare(b.filePath))) {
    console.log(`[${issue.level.toUpperCase()}] ${issue.filePath}: ${issue.message}`);
  }
}

async function main() {
  const { strict, json } = parseArgs(process.argv.slice(2));

  if (!(await pathExists(CANONICAL_SKILLS_DIR))) {
    throw new Error(`Canonical skills directory not found: ${CANONICAL_SKILLS_DIR}`);
  }

  const issues = [];
  const skillNames = await getSkillDirs();

  for (const skillName of skillNames) {
    await validateSkillFile(skillName, issues);
  }

  await validateMirrors(skillNames, issues);

  const summary = summarizeIssues(issues);
  const failed = summary.errors > 0 || (strict && summary.warnings > 0);

  if (json) {
    console.log(
      JSON.stringify(
        {
          skillCount: skillNames.length,
          strict,
          ...summary,
          issues,
          failed,
        },
        null,
        2,
      ),
    );
  } else {
    printHumanReport(skillNames.length, issues, strict);
  }

  if (failed) {
    process.exitCode = 1;
  }
}

runScript(main);
