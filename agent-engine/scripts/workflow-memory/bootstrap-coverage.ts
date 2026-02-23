#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { readWorkflowRegistry } from "../workflows/registry";
import { runScript } from "../lib/effect-script";

const MEMORY_DIR = path.join("agent-engine", "workflow-memory");
const INDEX_PATH = path.join(MEMORY_DIR, "index.json");
const EVENTS_DIR = path.join(MEMORY_DIR, "events");
const SUMMARIES_DIR = path.join(MEMORY_DIR, "summaries");

const USAGE = `Usage:
  pnpm workflow-memory:bootstrap [--month YYYY-MM] [--min 1] [--owner @automation] [--dry-run]

Examples:
  pnpm workflow-memory:bootstrap
  pnpm workflow-memory:bootstrap --month 2026-02 --min 1
  pnpm workflow-memory:bootstrap --dry-run
`;

type ExistingIndexRow = {
  id: string;
  date: string;
  month: string;
  workflow: string;
  title: string;
  severity: string;
  status: string;
  tags: string[];
  importance?: number;
  recency?: number;
  confidence?: number;
  eventFile: string;
  source?: string;
  isInitialization?: boolean;
};

type CoverageSummary = {
  knownWorkflows: string[];
  month: string;
  minPerWorkflow: number;
  countByWorkflow: Map<string, number>;
};

type SeededEvent = {
  id: string;
  event: Record<string, unknown>;
  indexRow: ExistingIndexRow;
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
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

function validateMonth(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

function validateDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readKnownWorkflows(): Promise<string[]> {
  const registry = await readWorkflowRegistry();
  const workflows = registry.coreWorkflows.map((entry) => entry.memoryKey.trim());

  if (workflows.length === 0) {
    throw new Error(
      "No core workflows found in workflow registry. Add coreWorkflows entries before running bootstrap.",
    );
  }

  return Array.from(new Set(workflows));
}

async function readJsonlIds(filePath: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const ids = new Set<string>();
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as { id?: string };
      if (typeof parsed.id === "string" && parsed.id.trim()) {
        ids.add(parsed.id);
      }
    }
    return ids;
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

async function ensureMonthlySummary(month: string): Promise<void> {
  const summaryPath = path.join(SUMMARIES_DIR, `${month}.md`);
  try {
    await fs.access(summaryPath);
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      const template = `# ${month} Workflow Memory Summary

## Top Repeated Patterns

- _No entries yet._

## Guardrails Added

- _No entries yet._

## Open Risks

- _No entries yet._

## Carry-Over Actions

- _No entries yet._
`;
      await fs.writeFile(summaryPath, template, "utf8");
      return;
    }
    throw error;
  }
}

function summarizeCoverage(
  indexRows: ExistingIndexRow[],
  month: string,
  minPerWorkflow: number,
  knownWorkflows: string[],
): CoverageSummary {
  const rowsForMonth = indexRows.filter((row) => row?.month === month);
  const countByWorkflow = new Map(knownWorkflows.map((workflow) => [workflow, 0]));

  for (const row of rowsForMonth) {
    if (!row || typeof row.workflow !== "string") continue;
    if (!countByWorkflow.has(row.workflow)) continue;
    countByWorkflow.set(row.workflow, (countByWorkflow.get(row.workflow) ?? 0) + 1);
  }

  return {
    knownWorkflows,
    month,
    minPerWorkflow,
    countByWorkflow,
  };
}

function missingCounts(summary: CoverageSummary): Map<string, number> {
  const gaps = new Map<string, number>();
  for (const workflow of summary.knownWorkflows) {
    const current = summary.countByWorkflow.get(workflow) ?? 0;
    const missing = Math.max(0, summary.minPerWorkflow - current);
    if (missing > 0) {
      gaps.set(workflow, missing);
    }
  }
  return gaps;
}

function nextEventId(base: string, existingIds: Set<string>): string {
  let candidate = base;
  let suffix = 1;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  existingIds.add(candidate);
  return candidate;
}

function buildSeededEvent(
  workflow: string,
  month: string,
  date: string,
  owner: string,
  minPerWorkflow: number,
  slotIndex: number,
  existingIds: Set<string>,
): SeededEvent {
  const eventFileName = `${month}.jsonl`;
  const baseId = `${date}-${slug(workflow)}-bootstrap-initialization-${month}-${slotIndex}`;
  const id = nextEventId(baseId, existingIds);
  const title = `Bootstrap initialization seed (${month})`;
  const tags = [
    "workflow-memory",
    "bootstrap",
    "initialization",
    "seeded",
    "memory-form:parametric",
    "memory-function:working",
    "memory-dynamics:write",
  ];

  const event: Record<string, unknown> = {
    id,
    date,
    workflow,
    title,
    trigger: "Workflow-memory coverage bootstrap for fresh repository/month baseline.",
    finding:
      "Initialization-only seeded event added to satisfy strict coverage baseline. This does not represent an observed workflow run.",
    evidence: `Command: pnpm workflow-memory:bootstrap --month ${month} --min ${minPerWorkflow}`,
    followUp:
      "Continue normal workflow execution and append observed events; keep initialization entries only as baseline markers.",
    reflection: "Initialization seed distinguishes bootstrap coverage from observed operational workflow activity.",
    feedback: "If this command is needed repeatedly, investigate why observed events are not being persisted.",
    owner,
    status: "closed",
    severity: "low",
    tags,
    source: "bootstrap",
    isInitialization: true,
    createdAt: new Date().toISOString(),
  };

  const indexRow: ExistingIndexRow = {
    id,
    date,
    month,
    workflow,
    title,
    severity: "low",
    status: "closed",
    tags,
    eventFile: path.join("events", eventFileName),
    source: "bootstrap",
    isInitialization: true,
  };

  return { id, event, indexRow };
}

function printCoverage(summary: CoverageSummary): void {
  const covered = summary.knownWorkflows.filter(
    (workflow) => (summary.countByWorkflow.get(workflow) ?? 0) >= summary.minPerWorkflow,
  ).length;

  console.log(
    `Coverage for ${summary.month}: ${covered}/${summary.knownWorkflows.length} workflows with >= ${summary.minPerWorkflow} entr${summary.minPerWorkflow === 1 ? "y" : "ies"}.`,
  );

  for (const workflow of summary.knownWorkflows) {
    console.log(`- ${workflow}: ${summary.countByWorkflow.get(workflow) ?? 0}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true" || args.h === "true") {
    console.log(USAGE);
    return;
  }

  const month = args.month ?? currentMonth();
  if (!validateMonth(month)) {
    throw new Error(`Invalid month: ${month}. Expected YYYY-MM.`);
  }

  const date = args.date ?? currentDate();
  if (!validateDate(date)) {
    throw new Error(`Invalid date: ${date}. Expected YYYY-MM-DD.`);
  }

  const minPerWorkflow = parsePositiveInt(args.min, 1);
  const owner = args.owner?.trim() || "@automation";
  const dryRun = args.dry_run === "true";

  const knownWorkflows = await readKnownWorkflows();
  const indexRows = await readJsonArray<ExistingIndexRow>(INDEX_PATH);
  const beforeSummary = summarizeCoverage(indexRows, month, minPerWorkflow, knownWorkflows);
  const gaps = missingCounts(beforeSummary);

  if (gaps.size === 0) {
    console.log("No bootstrap entries needed. Strict coverage baseline is already satisfied.");
    printCoverage(beforeSummary);
    return;
  }

  const eventFile = path.join(EVENTS_DIR, `${month}.jsonl`);
  const existingIds = await readJsonlIds(eventFile);
  const seededEvents: SeededEvent[] = [];

  for (const workflow of knownWorkflows) {
    const missing = gaps.get(workflow) ?? 0;
    for (let i = 1; i <= missing; i += 1) {
      seededEvents.push(
        buildSeededEvent(workflow, month, date, owner, minPerWorkflow, i, existingIds),
      );
    }
  }

  console.log(
    `${dryRun ? "Planned" : "Seeding"} ${seededEvents.length} initialization entr${seededEvents.length === 1 ? "y" : "ies"} for ${month}.`,
  );
  console.log("Initialization entries (seeded; not observed runs):");
  for (const seeded of seededEvents) {
    console.log(`- ${seeded.indexRow.workflow}: ${seeded.id}`);
  }

  if (dryRun) {
    return;
  }

  await fs.mkdir(EVENTS_DIR, { recursive: true });
  await fs.mkdir(SUMMARIES_DIR, { recursive: true });

  const lines = seededEvents.map((seeded) => JSON.stringify(seeded.event)).join("\n");
  await fs.appendFile(eventFile, `${lines}\n`, "utf8");

  const mergedRows = [...seededEvents.map((seeded) => seeded.indexRow), ...indexRows];
  const deduped = mergedRows.filter(
    (row, index, arr) => arr.findIndex((candidate) => candidate.id === row.id) === index,
  );
  deduped.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));

  await fs.writeFile(INDEX_PATH, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
  await ensureMonthlySummary(month);

  const afterSummary = summarizeCoverage(deduped, month, minPerWorkflow, knownWorkflows);
  printCoverage(afterSummary);
  console.log(
    "Bootstrap complete. These initialization entries are tagged and marked with source=bootstrap for analytics separation.",
  );
}

runScript(main);
