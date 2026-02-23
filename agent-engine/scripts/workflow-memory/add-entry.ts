#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { readWorkflowRegistry } from "../workflows/registry";
import { runScript } from "../lib/effect-script";
import { refreshMonthlySummary } from "./summary-refresh";

const MEMORY_DIR = path.join("agent-engine", "workflow-memory");
const INDEX_PATH = path.join(MEMORY_DIR, "index.json");
const EVENTS_DIR = path.join(MEMORY_DIR, "events");

const REQUIRED_ARGS = [
  "workflow",
  "title",
  "trigger",
  "finding",
  "evidence",
  "follow_up",
  "owner",
  "status",
];

const MEMORY_TRIGGER_TAGS = new Set(["memory", "workflow-memory", "memory-eval"]);
const MEMORY_FORM_PREFIX = "memory-form:";
const MEMORY_FUNCTION_PREFIX = "memory-function:";
const MEMORY_DYNAMICS_PREFIX = "memory-dynamics:";
const CAPABILITY_PREFIX = "capability:";
const FAILURE_PREFIX = "failure:";
const PERIODIC_SCANS_WORKFLOW = "Periodic Scans";
const BEST_PRACTICE_RESEARCHER_TAG = "best-practice-researcher";

const MEMORY_FORM_VALUES = new Set(["parametric", "external"]);
const MEMORY_FUNCTION_VALUES = new Set(["semantic", "episodic", "working"]);
const MEMORY_DYNAMICS_VALUES = new Set(["write", "retrieve", "decay", "conflict"]);
const CAPABILITY_VALUES = new Set([
  "planning",
  "tool-use",
  "long-term-reasoning",
  "instruction-following",
  "debugging",
]);
const FAILURE_VALUES = new Set([
  "tool-misuse",
  "state-loss",
  "incorrect-patch",
  "test-evasion",
  "env-drift",
]);

const USAGE = `Usage:
  pnpm workflow-memory:add-entry \\
    --workflow "Feature Delivery" \\
    --title "Short title" \\
    --trigger "What triggered this" \\
    --finding "Decision/finding" \\
    --evidence "File/PR/evidence" \\
    --follow-up "Guardrail/follow-up" \\
    --reflection "What went well/what to repeat" \\
    --feedback "What to improve/avoid" \\
    --owner "@team" \\
    --status "open" \\
    [--id custom-event-id] \\
    [--date YYYY-MM-DD] \\
    [--severity low|medium|high|critical] \\
    [--tags a,b,c] \\
    [--memory-form parametric|external[,..]] \\
    [--memory-function semantic|episodic|working[,..]] \\
    [--memory-dynamics write|retrieve|decay|conflict[,..]] \\
    [--capability planning|tool-use|long-term-reasoning|instruction-following|debugging[,..]] \\
    [--failure-mode tool-misuse|state-loss|incorrect-patch|test-evasion|env-drift[,..]] \\
    [--importance 0-1] \\
    [--recency 0-1] \\
    [--confidence 0-1] \\
    [--source manual] \\
    [--scenario-skill <skill-name>] \\
    [--scenario-check <check-name>] \\
    [--scenario-verdict pass|fail] \\
    [--scenario-pattern <pattern-name>] \\
    [--scenario-severity low|medium|high|critical] \\
    [--scan-walk-mode <mode>] \\
    [--scan-scope <scope>] \\
    [--scan-domain <domain>] \\
    [--scan-signal <signal>]

Scenario flags:
  When any --scenario-* flag is provided, --scenario-skill and --scenario-verdict
  are required. Scenarios create replayable test cases linked to fixture files at
  agent-engine/workflow-memory/scenarios/{id}.md.
`;

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    if (token === "--") {
      continue;
    }

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

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readKnownWorkflows() {
  const registry = await readWorkflowRegistry();
  const workflows = registry.coreWorkflows.map((entry) => entry.memoryKey.trim());

  if (workflows.length === 0) {
    throw new Error(
      "No core workflows found in workflow registry. Add coreWorkflows entries before writing memory events.",
    );
  }

  return Array.from(new Set(workflows));
}

async function readJsonlIds(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const ids = new Set();
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.id === "string") {
        ids.add(parsed.id);
      }
    }
    return ids;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

function validateDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function parseOptionalScore(args, key) {
  if (args[key] === undefined) {
    return null;
  }
  const value = Number(args[key]);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid ${key} score: ${args[key]}. Expected a number between 0 and 1.`);
  }
  return value;
}

function parseCsvValues(raw) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseTaxonomyValues(raw, allowedValues, flagName) {
  const values = parseCsvValues(raw);
  const invalid = values.filter((value) => !allowedValues.has(value));
  if (invalid.length > 0) {
    throw new Error(`Invalid ${flagName} value(s): ${invalid.join(", ")}.`);
  }
  return values;
}

function prefixed(values, prefix) {
  return values.map((value) => `${prefix}${value}`);
}

function collectPrefixedTags(tags, prefix, allowedValues, errors, label) {
  const matching = tags.filter((tag) => tag.startsWith(prefix));
  for (const tag of matching) {
    const value = tag.slice(prefix.length);
    if (!allowedValues.has(value)) {
      errors.push(`Unknown ${label} tag '${tag}'.`);
    }
  }
  return matching;
}

function validateTaxonomyTags(tags) {
  const errors = [];

  const memoryFormTags = collectPrefixedTags(
    tags,
    MEMORY_FORM_PREFIX,
    MEMORY_FORM_VALUES,
    errors,
    "memory-form",
  );
  const memoryFunctionTags = collectPrefixedTags(
    tags,
    MEMORY_FUNCTION_PREFIX,
    MEMORY_FUNCTION_VALUES,
    errors,
    "memory-function",
  );
  const memoryDynamicsTags = collectPrefixedTags(
    tags,
    MEMORY_DYNAMICS_PREFIX,
    MEMORY_DYNAMICS_VALUES,
    errors,
    "memory-dynamics",
  );

  const hasMemoryTaxonomy =
    memoryFormTags.length > 0 ||
    memoryFunctionTags.length > 0 ||
    memoryDynamicsTags.length > 0;
  const memoryRelated = hasMemoryTaxonomy || tags.some((tag) => MEMORY_TRIGGER_TAGS.has(tag));

  if (memoryRelated) {
    if (memoryFormTags.length === 0) {
      errors.push("Memory-related entries must include at least one memory-form:* tag.");
    }
    if (memoryFunctionTags.length === 0) {
      errors.push("Memory-related entries must include at least one memory-function:* tag.");
    }
    if (memoryDynamicsTags.length === 0) {
      errors.push("Memory-related entries must include at least one memory-dynamics:* tag.");
    }
  }

  const capabilityTags = collectPrefixedTags(
    tags,
    CAPABILITY_PREFIX,
    CAPABILITY_VALUES,
    errors,
    "capability",
  );
  const failureTags = collectPrefixedTags(
    tags,
    FAILURE_PREFIX,
    FAILURE_VALUES,
    errors,
    "failure",
  );

  if (capabilityTags.length > 0 && failureTags.length === 0) {
    errors.push("Entries with capability:* tags must include at least one failure:* tag.");
  }
  if (failureTags.length > 0 && capabilityTags.length === 0) {
    errors.push("Entries with failure:* tags must include at least one capability:* tag.");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid workflow-memory taxonomy tags:\n- ${errors.join("\n- ")}\nSee agent-engine/workflow-memory/taxonomy.md.`,
    );
  }
}

function assertKnownWorkflow(workflow, knownWorkflows) {
  if (knownWorkflows.includes(workflow)) {
    return;
  }

  throw new Error(
    `Unknown core workflow key "${workflow}". Use one of: ${knownWorkflows.join(", ")}. Utility skills must log using a parent core workflow key.`,
  );
}

function printCoverageSummary(index, month, knownWorkflows) {
  const workflowsInMonth = new Set(
    index
      .filter((row) => row && typeof row.month === "string" && row.month === month)
      .map((row) => row.workflow)
      .filter((workflow) => typeof workflow === "string"),
  );

  const missingWorkflows = knownWorkflows.filter((workflow) => !workflowsInMonth.has(workflow));

  console.log(
    `Workflow coverage for ${month}: ${knownWorkflows.length - missingWorkflows.length}/${knownWorkflows.length} workflows with events.`,
  );

  if (missingWorkflows.length > 0) {
    console.log(`Workflows with zero entries in ${month}: ${missingWorkflows.join(", ")}`);
    console.log(
      `Run coverage audit: pnpm workflow-memory:coverage --month ${month}`,
    );
  }
}

function buildScenario(args) {
  const hasScenarioFlags = Object.keys(args).some((k) => k.startsWith("scenario_"));
  if (!hasScenarioFlags) return undefined;

  if (!args.scenario_skill || !args.scenario_verdict) {
    throw new Error(
      "--scenario-skill and --scenario-verdict are required when using any --scenario-* flag",
    );
  }
  if (!["pass", "fail"].includes(args.scenario_verdict)) {
    throw new Error('--scenario-verdict must be "pass" or "fail"');
  }
  if (
    args.scenario_severity &&
    !["low", "medium", "high", "critical"].includes(args.scenario_severity)
  ) {
    throw new Error('--scenario-severity must be "low", "medium", "high", or "critical"');
  }

  return {
    skill: args.scenario_skill,
    check: args.scenario_check || null,
    verdict: args.scenario_verdict,
    pattern: args.scenario_pattern || null,
    severity: args.scenario_severity || null,
  };
}

function parseScanValue(raw, flagName) {
  if (raw === undefined) {
    return "";
  }

  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) {
    throw new Error(`Invalid ${flagName}: expected a non-empty value.`);
  }

  return normalized;
}

function buildScanMetadata(args) {
  const walkMode = parseScanValue(args.scan_walk_mode, "--scan-walk-mode");
  const scope = parseScanValue(args.scan_scope, "--scan-scope");
  const domain = parseScanValue(args.scan_domain, "--scan-domain");
  const signal = parseScanValue(args.scan_signal, "--scan-signal");

  const provided = [walkMode, scope, domain, signal].filter(Boolean);
  if (provided.length === 0) {
    return undefined;
  }

  if (provided.length !== 4) {
    throw new Error(
      "Structured scan metadata requires all scan flags together: --scan-walk-mode, --scan-scope, --scan-domain, --scan-signal.",
    );
  }

  return {
    walkMode,
    scope,
    domain,
    signal,
  };
}

function buildEvent(args) {
  const date = args.date ?? new Date().toISOString().slice(0, 10);
  if (!validateDate(date)) {
    throw new Error(`Invalid date: ${date}. Expected YYYY-MM-DD.`);
  }

  for (const key of REQUIRED_ARGS) {
    if (!args[key] || !args[key].trim()) {
      throw new Error(`Missing required argument: --${key.replace(/_/g, "-")}`);
    }
  }

  const workflow = args.workflow.trim();
  const title = args.title.trim();

  if (args.id && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(args.id.trim())) {
    throw new Error("--id must match [a-z0-9][a-z0-9-]*[a-z0-9]");
  }
  const id = args.id?.trim() || `${date}-${slug(workflow)}-${slug(title)}`;

  const baseTags = parseCsvValues(args.tags);
  const memoryFormTags = prefixed(
    parseTaxonomyValues(args.memory_form, MEMORY_FORM_VALUES, "--memory-form"),
    MEMORY_FORM_PREFIX,
  );
  const memoryFunctionTags = prefixed(
    parseTaxonomyValues(args.memory_function, MEMORY_FUNCTION_VALUES, "--memory-function"),
    MEMORY_FUNCTION_PREFIX,
  );
  const memoryDynamicsTags = prefixed(
    parseTaxonomyValues(args.memory_dynamics, MEMORY_DYNAMICS_VALUES, "--memory-dynamics"),
    MEMORY_DYNAMICS_PREFIX,
  );
  const capabilityTags = prefixed(
    parseTaxonomyValues(args.capability, CAPABILITY_VALUES, "--capability"),
    CAPABILITY_PREFIX,
  );
  const failureTags = prefixed(
    parseTaxonomyValues(args.failure_mode, FAILURE_VALUES, "--failure-mode"),
    FAILURE_PREFIX,
  );

  const tags = Array.from(
    new Set([
      ...baseTags,
      ...memoryFormTags,
      ...memoryFunctionTags,
      ...memoryDynamicsTags,
      ...capabilityTags,
      ...failureTags,
    ]),
  );
  validateTaxonomyTags(tags);

  const severity = (args.severity ?? "medium").trim().toLowerCase();
  const status = args.status.trim().toLowerCase();
  const importance = parseOptionalScore(args, "importance");
  const recency = parseOptionalScore(args, "recency");
  const confidence = parseOptionalScore(args, "confidence");

  const scoring = {
    ...(importance === null ? {} : { importance }),
    ...(recency === null ? {} : { recency }),
    ...(confidence === null ? {} : { confidence }),
  };

  const scenario = buildScenario(args);
  const scan = buildScanMetadata(args);

  if (
    workflow === PERIODIC_SCANS_WORKFLOW &&
    tags.includes(BEST_PRACTICE_RESEARCHER_TAG) &&
    !scan
  ) {
    throw new Error(
      `Periodic Scans entries tagged "${BEST_PRACTICE_RESEARCHER_TAG}" must include structured scan metadata via --scan-walk-mode, --scan-scope, --scan-domain, and --scan-signal.`,
    );
  }

  return {
    id,
    date,
    workflow,
    title,
    trigger: args.trigger.trim(),
    finding: args.finding.trim(),
    evidence: args.evidence.trim(),
    followUp: args.follow_up.trim(),
    reflection: args.reflection ? args.reflection.trim() : "",
    feedback: args.feedback ? args.feedback.trim() : "",
    owner: args.owner.trim(),
    status,
    severity,
    tags,
    ...scoring,
    ...(scenario ? { scenario } : {}),
    ...(scan ? { scan } : {}),
    source: (args.source ?? "manual").trim(),
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true" || args.h === "true") {
    console.log(USAGE);
    return;
  }

  const event = buildEvent(args);
  const knownWorkflows = await readKnownWorkflows();
  assertKnownWorkflow(event.workflow, knownWorkflows);
  const month = event.date.slice(0, 7);
  const eventFile = path.join(EVENTS_DIR, `${month}.jsonl`);

  await fs.mkdir(EVENTS_DIR, { recursive: true });

  const existingIds = await readJsonlIds(eventFile);
  if (existingIds.has(event.id)) {
    throw new Error(
      `Event id already exists in ${eventFile}: ${event.id}. Use --id to provide a unique value.`,
    );
  }

  await fs.appendFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");

  const index = await readJsonArray(INDEX_PATH);
  const compactRow = {
    id: event.id,
    date: event.date,
    month,
    workflow: event.workflow,
    title: event.title,
    severity: event.severity,
    status: event.status,
    tags: event.tags,
    ...(typeof event.importance === "number" ? { importance: event.importance } : {}),
    ...(typeof event.recency === "number" ? { recency: event.recency } : {}),
    ...(typeof event.confidence === "number" ? { confidence: event.confidence } : {}),
    ...(event.scenario ? { hasScenario: true, scenarioSkill: event.scenario.skill } : {}),
    ...(event.scan ? { scan: event.scan } : {}),
    eventFile: path.join("events", `${month}.jsonl`),
  };

  const deduped = [
    compactRow,
    ...index.filter((row) => row && typeof row.id === "string" && row.id !== event.id),
  ];
  deduped.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));

  await fs.writeFile(INDEX_PATH, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
  await refreshMonthlySummary(month);

  console.log(`Added workflow memory event: ${event.id}`);
  console.log(`Event file: ${eventFile}`);
  console.log(`Index updated: ${INDEX_PATH}`);
  console.log(`Summary refreshed: agent-engine/workflow-memory/summaries/${month}.md`);
  printCoverageSummary(deduped, month, knownWorkflows);
}

runScript(main);
