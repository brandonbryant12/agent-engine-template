#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { runScript } from "../lib/effect-script";

const MEMORY_DIR = path.join("agent-engine", "workflow-memory");
const EVENTS_DIR = path.join(MEMORY_DIR, "events");
const INDEX_PATH = path.join(MEMORY_DIR, "index.json");
const SCENARIOS_DIR = path.join(MEMORY_DIR, "scenarios");

const SAFE_ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i,
  /(?:secret|password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{8,}/i,
  /(?:token|bearer)\s+[A-Za-z0-9_\-/.]{20,}/i,
  /(?:sk|pk)[-_](?:live|test)[-_][A-Za-z0-9]{10,}/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{36}/,
  /xox[bpas]-[A-Za-z0-9\-]{10,}/,
];

const USAGE = `Usage:
  pnpm scenario:validate [options]

Options:
  --skill <name>    Filter by target skill
  --check <name>    Filter by specific check
  --id <event-id>   Validate single scenario
  --month <YYYY-MM> Filter by month
  --json            Output as JSON
  --strict          Exit code 1 on any validation failure
  --help            Show this help message

Validates scenario integrity:
  - Fixture file exists at agent-engine/workflow-memory/scenarios/{id}.md
  - Fixture has ## Input and ## Expected Findings sections
  - No secrets detected in fixture content
  - Event ID matches safe regex [a-z0-9][a-z0-9-]*[a-z0-9]
  - Fixture path is contained in scenarios directory (no symlink escapes)
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    if (token === "--") continue;
    const key = token.slice(2).replace(/-/g, "_");
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function isEventFile(name) {
  return /^\d{4}-\d{2}\.jsonl$/.test(name);
}

async function readJsonl(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

function scanSecrets(content) {
  const found = [];
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      found.push(pattern.source.slice(0, 40));
    }
  }
  return found;
}

async function validateFixture(scenarioId) {
  const errors = [];

  if (!SAFE_ID_RE.test(scenarioId)) {
    errors.push(`ID "${scenarioId}" does not match safe regex [a-z0-9][a-z0-9-]*[a-z0-9]`);
  }

  const fixturePath = path.resolve(SCENARIOS_DIR, `${scenarioId}.md`);
  const scenariosAbsolute = path.resolve(SCENARIOS_DIR);

  // Check path containment (reject symlink escapes)
  let realFixturePath;
  try {
    realFixturePath = await fs.realpath(fixturePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      errors.push("Fixture file missing");
      return { fixturePath, errors, status: "MISSING FIXTURE" };
    }
    throw error;
  }

  let realScenariosDir;
  try {
    realScenariosDir = await fs.realpath(scenariosAbsolute);
  } catch {
    realScenariosDir = scenariosAbsolute;
  }

  if (!realFixturePath.startsWith(realScenariosDir + path.sep) && realFixturePath !== realScenariosDir) {
    errors.push("Fixture path escapes scenarios directory (symlink escape detected)");
    return { fixturePath, errors, status: "SECURITY" };
  }

  const content = await fs.readFile(fixturePath, "utf8");

  if (!content.includes("## Input")) {
    errors.push('Missing "## Input" section');
  }
  if (!content.includes("## Expected Findings")) {
    errors.push('Missing "## Expected Findings" section');
  }

  const secrets = scanSecrets(content);
  if (secrets.length > 0) {
    errors.push(`Potential secrets detected: ${secrets.join(", ")}`);
  }

  const status = errors.length > 0 ? "INVALID" : "OK";
  return { fixturePath, errors, status };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true" || args.h === "true") {
    console.log(USAGE);
    return;
  }

  const strict = args.strict === "true";
  const jsonOutput = args.json === "true";
  const filterSkill = args.skill ? args.skill.trim() : "";
  const filterCheck = args.check ? args.check.trim() : "";
  const filterId = args.id ? args.id.trim() : "";
  const filterMonth = args.month ? args.month.trim() : "";

  // Read events from JSONL files (source of truth)
  let eventFiles;
  try {
    eventFiles = (await fs.readdir(EVENTS_DIR)).filter(isEventFile);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      eventFiles = [];
    } else {
      throw error;
    }
  }

  const allEvents = [];
  for (const fileName of eventFiles) {
    const month = fileName.replace(/\.jsonl$/, "");
    if (filterMonth && month !== filterMonth) continue;
    const events = await readJsonl(path.join(EVENTS_DIR, fileName));
    allEvents.push(...events);
  }

  // Filter to scenario events
  const scenarioEvents = allEvents.filter((event) => {
    if (!event || !event.scenario) return false;
    if (filterId && event.id !== filterId) return false;
    if (filterSkill && event.scenario.skill !== filterSkill) return false;
    if (filterCheck && event.scenario.check !== filterCheck) return false;
    return true;
  });

  // Cross-check index.json consistency
  const index = await readJsonArray(INDEX_PATH);
  const indexById = new Map(index.filter((r) => r && r.id).map((r) => [r.id, r]));
  const indexWarnings = [];

  for (const event of scenarioEvents) {
    const indexRow = indexById.get(event.id);
    if (!indexRow) {
      indexWarnings.push(`Event "${event.id}" missing from index.json`);
      continue;
    }
    if (!indexRow.hasScenario) {
      indexWarnings.push(`Event "${event.id}" has scenario in JSONL but missing hasScenario in index`);
    }
    if (indexRow.scenarioSkill !== event.scenario.skill) {
      indexWarnings.push(
        `Event "${event.id}" scenarioSkill mismatch: index="${indexRow.scenarioSkill}" vs event="${event.scenario.skill}"`,
      );
    }
  }

  // Validate each scenario
  const results = [];
  for (const event of scenarioEvents) {
    const validation = await validateFixture(event.id);
    results.push({
      id: event.id,
      skill: event.scenario.skill,
      check: event.scenario.check,
      verdict: event.scenario.verdict,
      status: validation.status,
      errors: validation.errors,
      fixturePath: validation.fixturePath,
    });
  }

  const valid = results.filter((r) => r.status === "OK").length;
  const invalid = results.length - valid;

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          total: results.length,
          valid,
          invalid,
          indexWarnings,
          scenarios: results,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Scenario Validation Report");
    console.log("\u2500".repeat(50));

    if (results.length === 0) {
      console.log("  No scenarios found.");
    }

    for (const r of results) {
      const label = `${r.skill} / ${r.check || "(no check)"} (${r.id})`;
      const dots = ".".repeat(Math.max(2, 50 - label.length - r.status.length - 4));
      console.log(`  ${label} ${dots} ${r.status}`);
      if (r.errors.length > 0) {
        for (const err of r.errors) {
          console.log(`    - ${err}`);
        }
      }
    }

    console.log("\u2500".repeat(50));
    console.log(`${results.length} scenarios, ${valid} valid, ${invalid} invalid`);

    if (indexWarnings.length > 0) {
      console.log(`\nIndex warnings (${indexWarnings.length}):`);
      for (const w of indexWarnings) {
        console.log(`  - ${w}`);
      }
    }
  }

  if (strict && invalid > 0) {
    process.exitCode = 1;
  }
}

runScript(main);
