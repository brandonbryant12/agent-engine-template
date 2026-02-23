#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { runScript } from "../lib/effect-script";
import { refreshMonthlySummaries } from "./summary-refresh";

const MEMORY_DIR = path.join("agent-engine", "workflow-memory");
const EVENTS_DIR = path.join(MEMORY_DIR, "events");
const INDEX_PATH = path.join(MEMORY_DIR, "index.json");
const ARCHIVE_DIR = path.join(EVENTS_DIR, "archive");

const USAGE = `Usage:
  pnpm workflow-memory:compact [--archive-closed] [--days 90] [--dry-run]
`;

const CLOSED_STATUSES = new Set(["closed", "resolved", "done"]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
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

function eventRow(event) {
  const month = String(event.date ?? "").slice(0, 7);
  return {
    id: event.id,
    date: event.date,
    month,
    workflow: event.workflow,
    title: event.title,
    severity: event.severity ?? "medium",
    status: event.status ?? "open",
    tags: Array.isArray(event.tags) ? event.tags : [],
    ...(typeof event.importance === "number" ? { importance: event.importance } : {}),
    ...(typeof event.recency === "number" ? { recency: event.recency } : {}),
    ...(typeof event.confidence === "number" ? { confidence: event.confidence } : {}),
    ...(event.scenario ? { hasScenario: true, scenarioSkill: event.scenario.skill } : {}),
    eventFile: path.join("events", `${month}.jsonl`),
  };
}

function isOlderThanDays(dateString, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const eventDate = new Date(`${dateString}T00:00:00.000Z`);
  const now = new Date();
  const cutoffMs = days * 24 * 60 * 60 * 1000;
  return now.getTime() - eventDate.getTime() > cutoffMs;
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

async function appendJsonl(filePath, entries, dryRun) {
  if (entries.length === 0) return;
  const payload = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
  if (!dryRun) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, payload, "utf8");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true" || args.h === "true") {
    console.log(USAGE);
    return;
  }

  const dryRun = args.dry_run === "true";
  const archiveClosed = args.archive_closed === "true";
  const days = Number.parseInt(args.days ?? "90", 10);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error(`Invalid --days value: ${args.days}`);
  }

  await fs.mkdir(EVENTS_DIR, { recursive: true });

  const eventFiles = (await fs.readdir(EVENTS_DIR)).filter(isEventFile);
  const byId = new Map();
  const archivedByMonth = new Map();
  let totalRead = 0;
  let duplicatesRemoved = 0;
  let archivedCount = 0;

  for (const fileName of eventFiles) {
    const month = fileName.replace(/\.jsonl$/, "");
    const filePath = path.join(EVENTS_DIR, fileName);
    const events = await readJsonl(filePath);
    totalRead += events.length;

    for (const event of events) {
      if (!event || typeof event !== "object" || typeof event.id !== "string") {
        continue;
      }

      const status = String(event.status ?? "open").toLowerCase();
      if (archiveClosed && CLOSED_STATUSES.has(status) && isOlderThanDays(String(event.date ?? ""), days)) {
        if (!archivedByMonth.has(month)) {
          archivedByMonth.set(month, []);
        }
        archivedByMonth.get(month).push(event);
        archivedCount += 1;
        continue;
      }

      if (byId.has(event.id)) {
        duplicatesRemoved += 1;
      }
      byId.set(event.id, event);
    }
  }

  const activeEvents = [...byId.values()];
  activeEvents.sort((a, b) =>
    a.date === b.date ? String(a.id).localeCompare(String(b.id)) : String(a.date).localeCompare(String(b.date)),
  );

  const byMonth = new Map();
  for (const event of activeEvents) {
    const month = String(event.date ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      continue;
    }
    if (!byMonth.has(month)) {
      byMonth.set(month, []);
    }
    byMonth.get(month).push(event);
  }

  if (!dryRun) {
    for (const fileName of eventFiles) {
      await fs.writeFile(path.join(EVENTS_DIR, fileName), "", "utf8");
    }
    for (const [month, events] of byMonth) {
      const target = path.join(EVENTS_DIR, `${month}.jsonl`);
      const payload = `${events.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
      await fs.writeFile(target, payload, "utf8");
    }
  }

  if (archiveClosed) {
    for (const [month, entries] of archivedByMonth) {
      const archiveFile = path.join(ARCHIVE_DIR, `${month}.jsonl`);
      await appendJsonl(archiveFile, entries, dryRun);
    }
  }

  const indexRows = activeEvents
    .filter((entry) => entry.date && entry.workflow && entry.title)
    .map((entry) => eventRow(entry))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));

  if (!dryRun) {
    await fs.writeFile(INDEX_PATH, `${JSON.stringify(indexRows, null, 2)}\n`, "utf8");
    await refreshMonthlySummaries([...byMonth.keys()]);
  }

  console.log(
    `${dryRun ? "Dry run" : "Compaction"} complete. Read=${totalRead}, active=${activeEvents.length}, deduped=${duplicatesRemoved}, archived=${archivedCount}, summaries=${byMonth.size}.`,
  );
}

runScript(main);
